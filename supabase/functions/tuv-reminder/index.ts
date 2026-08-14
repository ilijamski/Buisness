// Fuhrpark-Manager: TÜV reminder Edge Function.
//
// Runs on a daily schedule (see README for the pg_cron setup). Finds every
// vehicle whose TÜV date falls within the next REMINDER_WINDOW_DAYS days,
// skips vehicles already logged in `tuv_reminders` for that exact tuv_date,
// emails all admins via Resend, and records the reminder so it is only sent
// once per (vehicle, tuv_date) pair — even if a daily run is missed and the
// vehicle is picked up again on a later day within the window.
//
// Required secrets (set via `supabase secrets set`):
//   RESEND_API_KEY       Resend API key
//   REMINDER_FROM_EMAIL  Verified "from" address, e.g. "Fuhrpark-Manager <noreply@firma.de>"
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
// Supabase Edge Runtime.

import { createClient } from "jsr:@supabase/supabase-js@2";

const REMINDER_WINDOW_DAYS = 30;

type Vehicle = {
  id: string;
  name: string;
  plate: string;
  tuv_date: string;
};

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");
    }
    if (!resendApiKey || !fromEmail) {
      return Response.json(
        { sent: 0, skipped: "RESEND_API_KEY or REMINDER_FROM_EMAIL not configured" },
        { status: 200 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = todayUTC();
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + REMINDER_WINDOW_DAYS);

    const { data: dueVehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, name, plate, tuv_date")
      .not("tuv_date", "is", null)
      .gte("tuv_date", toDateString(today))
      .lte("tuv_date", toDateString(windowEnd));

    if (vehiclesError) throw vehiclesError;

    const vehicles = (dueVehicles ?? []) as Vehicle[];
    if (vehicles.length === 0) {
      return Response.json({ sent: 0, due: 0 }, { status: 200 });
    }

    const { data: alreadySent, error: remindersError } = await supabase
      .from("tuv_reminders")
      .select("vehicle_id, tuv_date")
      .in("vehicle_id", vehicles.map((v) => v.id));

    if (remindersError) throw remindersError;

    const sentKeys = new Set(
      (alreadySent ?? []).map((r) => `${r.vehicle_id}|${r.tuv_date}`),
    );
    const pending = vehicles.filter((v) => !sentKeys.has(`${v.id}|${v.tuv_date}`));

    if (pending.length === 0) {
      return Response.json({ sent: 0, due: vehicles.length }, { status: 200 });
    }

    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin");

    if (adminsError) throw adminsError;

    const adminEmails = (admins ?? [])
      .map((a) => a.email)
      .filter((email): email is string => !!email);

    if (adminEmails.length === 0) {
      return Response.json({ sent: 0, skipped: "no admin recipients" }, { status: 200 });
    }

    let sent = 0;
    for (const vehicle of pending) {
      const daysLeft = Math.round(
        (new Date(vehicle.tuv_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: adminEmails,
          subject: `TÜV fällig in ${daysLeft} Tagen: ${vehicle.name} (${vehicle.plate})`,
          html: `
            <p>Der TÜV für <strong>${vehicle.name}</strong> (${vehicle.plate}) läuft am
            <strong>${vehicle.tuv_date}</strong> ab — das ist in ${daysLeft} Tagen.</p>
            <p>Bitte rechtzeitig einen Termin vereinbaren.</p>
          `,
        }),
      });

      if (!res.ok) {
        console.error(`Resend error for vehicle ${vehicle.id}: ${res.status} ${await res.text()}`);
        continue;
      }

      const { error: logError } = await supabase
        .from("tuv_reminders")
        .upsert(
          { vehicle_id: vehicle.id, tuv_date: vehicle.tuv_date },
          { onConflict: "vehicle_id,tuv_date" },
        );
      if (logError) {
        console.error(`Failed to log reminder for vehicle ${vehicle.id}:`, logError.message);
        continue;
      }

      sent++;
    }

    return Response.json({ sent, due: vehicles.length }, { status: 200 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
