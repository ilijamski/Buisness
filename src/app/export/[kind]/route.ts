import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveModules } from "@/lib/modules";
import { vehicleDeadlines } from "@/lib/deadlines";
import { sampleCsv } from "@/lib/csv-import";
import type { Vehicle } from "@/lib/types";

/**
 * CSV-Export für Einträge und Fahrtenbuch.
 *
 * Semikolon als Trennzeichen und Komma als Dezimaltrennzeichen, weil Excel in
 * deutscher Einstellung sonst alles in eine Spalte legt. BOM voran, damit
 * Umlaute korrekt erkannt werden.
 */

type Row = Record<string, string | number | null | undefined>;

function toCsv(headers: string[], rows: Row[]): string {
  const escape = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "number" ? String(value).replace(".", ",") : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(";"));
  }
  return "﻿" + lines.join("\r\n");
}

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Export enthält Firmendaten — nie in Zwischenspeichern ablegen.
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const vehicleId = request.nextUrl.searchParams.get("fahrzeug");
  const today = new Date().toISOString().slice(0, 10);

  // Fahrzeugnamen für lesbare Spalten; RLS begrenzt das bereits auf das,
  // was der Aufrufer sehen darf.
  const { data: vehicles } = await supabase.from("vehicles").select("id, name, plate");
  const vehicleById = new Map(
    (vehicles ?? []).map((v) => [v.id as string, `${v.name} (${v.plate})`]),
  );

  if (kind === "eintraege") {
    let query = supabase.from("entries").select("*").order("date", { ascending: false });
    if (vehicleId) query = query.eq("vehicle_id", vehicleId);

    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 400 });

    const headers = ["Datum", "Fahrzeug", "Art", "Kosten", "Notiz", "Beleg"];
    const rows: Row[] = (data ?? []).map((entry) => ({
      Datum: entry.date,
      Fahrzeug: vehicleById.get(entry.vehicle_id) ?? entry.vehicle_id,
      Art: entry.type,
      Kosten: Number(entry.cost),
      Notiz: entry.note,
      Beleg: entry.receipt_path ? "ja" : "nein",
    }));

    return csvResponse(`eintraege-${today}.csv`, toCsv(headers, rows));
  }

  if (kind === "fahrtenbuch") {
    let query = supabase
      .from("logbook_entries")
      .select("*")
      .order("date", { ascending: false });
    if (vehicleId) query = query.eq("vehicle_id", vehicleId);

    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 400 });

    const headers = [
      "Datum",
      "Fahrzeug",
      "Art",
      "km Start",
      "km Ende",
      "Gefahrene km",
      "Von",
      "Nach",
      "Zweck",
    ];
    const rows: Row[] = (data ?? []).map((trip) => ({
      Datum: trip.date,
      Fahrzeug: vehicleById.get(trip.vehicle_id) ?? trip.vehicle_id,
      Art: trip.trip_type,
      "km Start": trip.start_mileage,
      "km Ende": trip.end_mileage,
      "Gefahrene km": trip.end_mileage - trip.start_mileage,
      Von: trip.start_location,
      Nach: trip.end_location,
      Zweck: trip.purpose,
    }));

    return csvResponse(`fahrtenbuch-${today}.csv`, toCsv(headers, rows));
  }

  if (kind === "vorlage") {
    return csvResponse("fuhrpark-vorlage.csv", "﻿" + sampleCsv());
  }

  if (kind === "fristen") {
    const { data, error } = await supabase.from("vehicles").select("*");
    if (error) return new NextResponse(error.message, { status: 400 });

    const config = await loadCompanyModulesForExport(supabase);

    const headers = ["Fahrzeug", "Kennzeichen", "Art", "Termin", "Tage", "Status"];
    const rows: Row[] = ((data as Vehicle[] | null) ?? [])
      .flatMap((vehicle) =>
        vehicleDeadlines(vehicle, config).map((deadline) => ({ vehicle, deadline })),
      )
      .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft)
      .map(({ vehicle, deadline }) => ({
        Fahrzeug: vehicle.name,
        Kennzeichen: vehicle.plate,
        Art: deadline.label,
        Termin: deadline.date,
        Tage: deadline.daysLeft,
        Status:
          deadline.status === "overdue"
            ? "überfällig"
            : deadline.status === "due-soon"
              ? "fällig"
              : "offen",
      }));

    return csvResponse(`fristen-${today}.csv`, toCsv(headers, rows));
  }

  return new NextResponse("Unbekannter Export", { status: 404 });
}

/**
 * Modul-Grundeinstellung für den Export.
 *
 * `loadCompanyModules` aus `lib/auth` würde eine eigene Verbindung aufbauen;
 * hier ist die des Aufrufers schon offen, und RLS begrenzt die Zeilen ohnehin
 * auf die eigene Firma.
 */
async function loadCompanyModulesForExport(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data } = await supabase
    .from("company_module_settings")
    .select("module_key, enabled, required");
  return resolveModules(data ?? []);
}
