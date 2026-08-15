// Fuhrpark-Manager: Erinnerungen für alle Fristen-Module.
//
// Läuft täglich (siehe README) und meldet jede Frist, die innerhalb der
// nächsten REMINDER_WINDOW_DAYS Tage fällig wird, an alle Admins der
// jeweiligen Firma. Abgedeckt sind alle Fristen-Module (HU, AU, UVV,
// Tachograf, Versicherung, Inspektion, Reifen, Bremsen, Leasing, Steuer)
// sowie ablaufende Führerscheine.
//
// Bereits verschickte Erinnerungen werden in reminder_log protokolliert,
// sodass jede Fälligkeit genau einmal gemeldet wird — auch wenn ein
// Cron-Lauf ausfällt und die Frist an einem späteren Tag erneut im Fenster
// liegt. Deaktivierte Module werden übersprungen: die Firmeneinstellung wird
// bei Bedarf durch die Fahrzeugeinstellung überschrieben, analog zur App.
//
// Secrets: RESEND_API_KEY, REMINDER_FROM_EMAIL
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY liefert die Edge-Runtime.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/** Genutzt, wenn eine Firma keine eigene Vorlaufzeit gesetzt hat. */
const DEFAULT_LEAD_DAYS = 30;
/** Obergrenze für die Vorabfrage; je Firma wird danach exakt gefiltert. */
const MAX_LEAD_DAYS = 365;

/**
 * Fristen-Module: Spalte in `vehicles` -> Modul-Key + Anzeigename.
 * Muss zu src/lib/modules.ts passen (Deno kann den App-Code nicht importieren).
 */
const VEHICLE_DEADLINES: { field: string; moduleKey: string; label: string }[] = [
  { field: "hu_date", moduleKey: "hu", label: "TÜV / Hauptuntersuchung" },
  { field: "au_date", moduleKey: "au", label: "Abgasuntersuchung (AU)" },
  { field: "uvv_date", moduleKey: "uvv", label: "UVV-Prüfung" },
  { field: "tachograph_date", moduleKey: "tachograph", label: "Tachograf-Eichung" },
  { field: "insurance_expires_on", moduleKey: "insurance", label: "Kfz-Versicherung" },
  { field: "next_service_date", moduleKey: "service", label: "Inspektion / Ölwechsel" },
  { field: "next_tire_change_date", moduleKey: "tires", label: "Reifenwechsel" },
  { field: "next_brake_check_date", moduleKey: "brakes", label: "Bremsen-Check" },
  { field: "leasing_end_date", moduleKey: "leasing", label: "Leasing-Laufzeitende" },
  { field: "tax_due_date", moduleKey: "tax", label: "Kfz-Steuer" },
];

type VehicleRow = Record<string, string | number | null> & {
  id: string;
  company_id: string;
  name: string;
  plate: string;
};

type PendingReminder = {
  subjectType: "vehicle" | "profile";
  subjectId: string;
  companyId: string;
  moduleKey: string;
  label: string;
  dueDate: string;
  title: string;
  body: string;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: Date, isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.round((target - from.getTime()) / (1000 * 60 * 60 * 24));
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.");
    }
    if (!resendApiKey || !fromEmail) {
      return Response.json(
        { sent: 0, skipped: "RESEND_API_KEY oder REMINDER_FROM_EMAIL nicht gesetzt" },
        { status: 200 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + MAX_LEAD_DAYS);

    const todayStr = toDateString(today);
    const windowEndStr = toDateString(windowEnd);

    // Modul-Einstellungen und firmenspezifische Vorlaufzeiten laden.
    const [{ data: companySettings }, { data: vehicleSettings }, { data: companies }] =
      await Promise.all([
        supabase.from("company_module_settings").select("company_id, module_key, enabled"),
        supabase.from("vehicle_module_settings").select("vehicle_id, module_key, enabled"),
        supabase.from("companies").select("id, reminder_lead_days"),
      ]);

    const leadDaysByCompany = new Map(
      (companies ?? []).map((c) => [
        c.id as string,
        (c.reminder_lead_days as number | null) ?? DEFAULT_LEAD_DAYS,
      ]),
    );

    /** Frist liegt im von der Firma eingestellten Vorlauf-Fenster. */
    function withinLeadWindow(companyId: string, daysLeft: number): boolean {
      return daysLeft <= (leadDaysByCompany.get(companyId) ?? DEFAULT_LEAD_DAYS);
    }

    const companyDisabled = new Set(
      (companySettings ?? [])
        .filter((s) => s.enabled === false)
        .map((s) => `${s.company_id}|${s.module_key}`),
    );
    const vehicleOverride = new Map(
      (vehicleSettings ?? [])
        .filter((s) => s.enabled !== null)
        .map((s) => [`${s.vehicle_id}|${s.module_key}`, s.enabled as boolean]),
    );

    function moduleActive(companyId: string, vehicleId: string, moduleKey: string): boolean {
      const override = vehicleOverride.get(`${vehicleId}|${moduleKey}`);
      if (override !== undefined) return override;
      return !companyDisabled.has(`${companyId}|${moduleKey}`);
    }

    const pending: PendingReminder[] = [];

    // --- Fahrzeugfristen ---------------------------------------------------
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("active", true);
    if (vehiclesError) throw vehiclesError;

    for (const vehicle of (vehicles ?? []) as VehicleRow[]) {
      if (!vehicle.company_id) continue;

      for (const deadline of VEHICLE_DEADLINES) {
        const value = vehicle[deadline.field];
        if (typeof value !== "string" || !value) continue;
        if (value < todayStr || value > windowEndStr) continue;
        if (!moduleActive(vehicle.company_id, vehicle.id, deadline.moduleKey)) continue;

        const daysLeft = daysBetween(today, value);
        if (!withinLeadWindow(vehicle.company_id, daysLeft)) continue;

        pending.push({
          subjectType: "vehicle",
          subjectId: vehicle.id,
          companyId: vehicle.company_id,
          moduleKey: deadline.moduleKey,
          label: deadline.label,
          dueDate: value,
          title: `${deadline.label} fällig in ${daysLeft} Tagen: ${vehicle.name} (${vehicle.plate})`,
          body: `<p><strong>${deadline.label}</strong> für <strong>${vehicle.name}</strong> (${vehicle.plate})
                 ist am <strong>${value}</strong> fällig — das ist in ${daysLeft} Tagen.</p>
                 <p>Bitte rechtzeitig einen Termin vereinbaren.</p>`,
        });
      }
    }

    // --- Führerscheine -----------------------------------------------------
    const { data: drivers, error: driversError } = await supabase
      .from("profiles")
      .select("id, company_id, full_name, email, license_classes, license_expires_on")
      .not("license_expires_on", "is", null)
      .gte("license_expires_on", todayStr)
      .lte("license_expires_on", windowEndStr);
    if (driversError) throw driversError;

    for (const driver of drivers ?? []) {
      if (!driver.company_id) continue;
      if (companyDisabled.has(`${driver.company_id}|license`)) continue;

      const dueDate = driver.license_expires_on as string;
      const daysLeft = daysBetween(today, dueDate);
      if (!withinLeadWindow(driver.company_id, daysLeft)) continue;

      const name = driver.full_name || driver.email;
      pending.push({
        subjectType: "profile",
        subjectId: driver.id,
        companyId: driver.company_id,
        moduleKey: "license",
        label: "Führerschein",
        dueDate,
        title: `Führerschein läuft in ${daysLeft} Tagen ab: ${name}`,
        body: `<p>Der Führerschein von <strong>${name}</strong>
               ${driver.license_classes ? `(Klassen ${driver.license_classes})` : ""}
               läuft am <strong>${dueDate}</strong> ab — das ist in ${daysLeft} Tagen.</p>`,
      });
    }

    if (pending.length === 0) {
      return Response.json({ sent: 0, due: 0 }, { status: 200 });
    }

    // Bereits gemeldete Fälligkeiten herausfiltern.
    const { data: alreadySent, error: logError } = await supabase
      .from("reminder_log")
      .select("subject_type, subject_id, module_key, due_date");
    if (logError) throw logError;

    const sentKeys = new Set(
      (alreadySent ?? []).map(
        (r) => `${r.subject_type}|${r.subject_id}|${r.module_key}|${r.due_date}`,
      ),
    );
    const todo = pending.filter(
      (p) => !sentKeys.has(`${p.subjectType}|${p.subjectId}|${p.moduleKey}|${p.dueDate}`),
    );

    if (todo.length === 0) {
      return Response.json({ sent: 0, due: pending.length }, { status: 200 });
    }

    // Admin-Empfänger je Firma, ohne alle, die E-Mail-Erinnerungen abbestellt haben.
    const [{ data: admins, error: adminsError }, { data: optOuts }] = await Promise.all([
      supabase.from("profiles").select("id, email, company_id").eq("role", "admin"),
      supabase.from("user_settings").select("user_id").eq("email_reminders", false),
    ]);
    if (adminsError) throw adminsError;

    const unsubscribed = new Set((optOuts ?? []).map((row) => row.user_id as string));

    const recipientsByCompany = new Map<string, string[]>();
    for (const admin of admins ?? []) {
      if (!admin.company_id || !admin.email) continue;
      if (unsubscribed.has(admin.id as string)) continue;
      const list = recipientsByCompany.get(admin.company_id) ?? [];
      list.push(admin.email);
      recipientsByCompany.set(admin.company_id, list);
    }

    // Push-Abos der Admins, die Push nicht abgeschaltet haben.
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? `mailto:${fromEmail}`;
    const pushEnabled = Boolean(vapidPublic && vapidPrivate);

    if (pushEnabled) {
      webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);
    }

    const [{ data: subscriptions }, { data: pushOptOuts }] = await Promise.all([
      supabase.from("push_subscriptions").select("*").eq("platform", "web"),
      supabase.from("user_settings").select("user_id").eq("push_reminders", false),
    ]);

    const pushUnsubscribed = new Set((pushOptOuts ?? []).map((row) => row.user_id as string));
    const adminIdsByCompany = new Map<string, string[]>();
    for (const admin of admins ?? []) {
      if (!admin.company_id) continue;
      const list = adminIdsByCompany.get(admin.company_id) ?? [];
      list.push(admin.id as string);
      adminIdsByCompany.set(admin.company_id, list);
    }

    async function sendPush(companyId: string, title: string, body: string) {
      if (!pushEnabled) return;

      const adminIds = new Set(adminIdsByCompany.get(companyId) ?? []);
      const targets = (subscriptions ?? []).filter(
        (sub) =>
          adminIds.has(sub.user_id as string) && !pushUnsubscribed.has(sub.user_id as string),
      );

      for (const sub of targets) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint as string,
              keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
            },
            JSON.stringify({ title, body, url: "/", tag: "frist" }),
          );
        } catch (error) {
          // 404/410 = Abo ist tot (App deinstalliert) und wird aufgeräumt.
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          } else {
            console.error("Push-Fehler:", error);
          }
        }
      }
    }

    let sent = 0;
    for (const reminder of todo) {
      const recipients = recipientsByCompany.get(reminder.companyId);
      if (!recipients || recipients.length === 0) continue;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipients,
          subject: reminder.title,
          html: reminder.body,
        }),
      });

      if (!res.ok) {
        console.error(`Resend-Fehler (${reminder.moduleKey}): ${res.status} ${await res.text()}`);
        continue;
      }

      const { error: insertError } = await supabase.from("reminder_log").upsert(
        {
          subject_type: reminder.subjectType,
          subject_id: reminder.subjectId,
          module_key: reminder.moduleKey,
          due_date: reminder.dueDate,
        },
        { onConflict: "subject_type,subject_id,module_key,due_date" },
      );
      if (insertError) {
        console.error(`Protokollierung fehlgeschlagen: ${insertError.message}`);
        continue;
      }

      // Push ergänzt die E-Mail; ein Fehler hier darf den Lauf nicht stoppen.
      await sendPush(
        reminder.companyId,
        reminder.title,
        `Fällig am ${reminder.dueDate}.`,
      );

      sent++;
    }

    return Response.json({ sent, due: pending.length }, { status: 200 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
