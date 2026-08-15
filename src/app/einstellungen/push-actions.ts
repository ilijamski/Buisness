"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";

/**
 * Push-Abo speichern (ein Eintrag je Gerät).
 * Bei Web-Push trägt `endpoint` die Endpoint-URL, in der nativen App das
 * Gerätetoken von APNs bzw. FCM.
 */
export async function savePushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  platform?: "web" | "ios" | "android";
}): Promise<ActionState> {
  const { profile } = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: profile.id,
      platform: subscription.platform ?? "web",
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      user_agent: subscription.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return { error: `Abo konnte nicht gespeichert werden: ${error.message}`, success: false };
  }

  revalidatePath("/einstellungen");
  return { error: null, success: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionState> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    return { error: `Abo konnte nicht entfernt werden: ${error.message}`, success: false };
  }

  revalidatePath("/einstellungen");
  return { error: null, success: true };
}
