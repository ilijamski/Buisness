import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Entry } from "@/lib/types";

export const RECEIPTS_BUCKET = "receipts";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function getReceiptUrls(
  supabase: SupabaseClient<Database>,
  entries: Pick<Entry, "receipt_path">[],
): Promise<Map<string, string>> {
  const paths = entries
    .map((entry) => entry.receipt_path)
    .filter((path): path is string => !!path);

  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const { data } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}
