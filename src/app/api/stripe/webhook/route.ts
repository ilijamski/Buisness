import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import type { Database } from "@/lib/types";

/**
 * Stripe-Webhook: pflegt den Abo-Status der Firma.
 *
 * Läuft mit dem Service-Role-Key, weil hier kein Nutzer angemeldet ist —
 * deshalb wird die Signatur streng geprüft, bevor irgendetwas passiert.
 */

function admin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Übersetzt Stripe-Status in unsere vier Zustände. */
function mapStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "active":
    case "trialing":
      return "active" as const;
    case "past_due":
    case "unpaid":
      return "past_due" as const;
    default:
      return "canceled" as const;
  }
}

async function applySubscription(subscription: Stripe.Subscription) {
  const companyId = subscription.metadata?.company_id;
  const supabase = admin();

  // Zuordnung bevorzugt über die Metadaten, ersatzweise über die Kunden-ID.
  const filter = companyId
    ? { column: "id" as const, value: companyId }
    : { column: "stripe_customer_id" as const, value: String(subscription.customer) };

  const item = subscription.items.data[0];
  const plan =
    item?.price.id === process.env.STRIPE_PRICE_YEARLY
      ? "yearly"
      : item?.price.id === process.env.STRIPE_PRICE_MONTHLY
        ? "monthly"
        : null;

  await supabase
    .from("companies")
    .update({
      subscription_status: mapStatus(subscription.status),
      plan,
      stripe_subscription_id: subscription.id,
      current_period_end: toIso(item?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end === true,
    })
    .eq(filter.column, filter.value);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Signatur fehlt" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    // Ungültige Signatur: Anfrage stammt nicht von Stripe.
    return NextResponse.json(
      { error: `Signatur ungültig: ${error instanceof Error ? error.message : ""}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object);
        break;

      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(
            String(session.subscription),
          );
          await applySubscription(subscription);
        }
        break;
      }

      default:
        // Andere Ereignisse interessieren uns nicht.
        break;
    }
  } catch (error) {
    console.error("Webhook-Verarbeitung fehlgeschlagen:", error);
    // 500 lässt Stripe erneut zustellen.
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
