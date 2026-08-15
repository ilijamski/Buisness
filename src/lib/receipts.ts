import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export const RECEIPTS_BUCKET = "receipts";
export const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Erzeugt Signed URLs für private Storage-Dateien.
 * Rückgabe: Map von Pfad -> URL (fehlende Dateien fehlen in der Map).
 */
export async function getSignedUrls(
  supabase: SupabaseClient<Database>,
  bucket: string,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const cleaned = [...new Set(paths.filter((p): p is string => !!p))];

  const map = new Map<string, string>();
  if (cleaned.length === 0) return map;

  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(cleaned, SIGNED_URL_TTL_SECONDS);

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

export async function getReceiptUrls(
  supabase: SupabaseClient<Database>,
  entries: { receipt_path: string | null }[],
): Promise<Map<string, string>> {
  return getSignedUrls(
    supabase,
    RECEIPTS_BUCKET,
    entries.map((entry) => entry.receipt_path),
  );
}
