"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireSession } from "@/lib/auth";
import { getStripe, priceIdFor } from "@/lib/stripe";
import type { ActionState } from "@/lib/action-state";
import type { Plan } from "@/lib/billing";

async function siteUrl(): Promise<string> {
  const headerList = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `https://${headerList.get("host") ?? "localhost:3000"}`
  );
}

/**
 * Startet den Bezahlvorgang und leitet zu Stripe weiter.
 * Nur Admins — sie schließen das Abo für die ganze Firma ab.
 */
export async function startCheckout(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile, company } = await requireAdmin();
  if (!company) return { error: "Keine Firma zugeordnet.", success: false };

  const plan = String(formData.get("plan") ?? "monthly") as Plan;
  if (plan !== "monthly" && plan !== "yearly") {
    return { error: "Unbekannter Tarif.", success: false };
  }

  const origin = await siteUrl();
  const stripe = getStripe();
  const supabase = await createClient();

  let customerId = company.stripe_customer_id;

  // Kunde einmalig anlegen und merken, damit Zahlungsdaten und Historie
  // bei Tarifwechseln erhalten bleiben.
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.name,
      email: company.contact_email ?? profile.email,
      metadata: { company_id: company.id },
    });
    customerId = customer.id;

    await supabase
      .from("companies")
      .update({ stripe_customer_id: customerId })
      .eq("id", company.id);
  }

  let checkoutUrl: string;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      locale: "de",
      allow_promotion_codes: false,
      // Die Firma steht in den Metadaten, damit der Webhook sie zuordnen kann,
      // ohne sich auf die E-Mail-Adresse verlassen zu müssen.
      metadata: { company_id: company.id, plan },
      subscription_data: { metadata: { company_id: company.id, plan } },
      success_url: `${origin}/abo?bezahlt=1`,
      cancel_url: `${origin}/abo?abgebrochen=1`,
    });

    if (!session.url) {
      return { error: "Stripe hat keine Bezahlseite geliefert.", success: false };
    }
    checkoutUrl = session.url;
  } catch (error) {
    return {
      error: `Bezahlvorgang konnte nicht gestartet werden: ${
        error instanceof Error ? error.message : "unbekannter Fehler"
      }`,
      success: false,
    };
  }

  redirect(checkoutUrl);
}

/** Öffnet das Stripe-Kundenportal (Kündigen, Rechnungen, Zahlungsmittel). */
export async function openBillingPortal(): Promise<void> {
  const { company } = await requireAdmin();
  if (!company?.stripe_customer_id) {
    redirect("/abo?fehler=kein-kunde");
  }

  const origin = await siteUrl();
  const session = await getStripe().billingPortal.sessions.create({
    customer: company.stripe_customer_id,
    return_url: `${origin}/abo`,
    locale: "de",
  });

  redirect(session.url);
}

/** Testcode einlösen — verlängert den Gratiszeitraum. */
export async function redeemCode(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Bitte einen Code eingeben.", success: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_promo_code", { p_code: code });

  if (error) {
    return { error: `Code konnte nicht geprüft werden: ${error.message}`, success: false };
  }

  const result = data as { ok: boolean; error?: string; days?: number };
  if (!result?.ok) {
    return { error: result?.error ?? "Dieser Code ist ungültig.", success: false };
  }

  revalidatePath("/abo");
  return { error: null, success: true };
}
