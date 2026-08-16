"use server";

import { requireActiveSession } from "@/lib/auth";
import {
  scanReceipt,
  isScanConfigured,
  isSupportedMediaType,
} from "@/lib/receipt-scan";
import { idleScanState, type ScanState } from "@/lib/scan-state";

/**
 * Liest einen fotografierten Beleg aus.
 *
 * Läuft auf dem Server, weil der API-Schlüssel dort bleiben muss — im
 * Browser wäre er für jeden Besucher abgreifbar. `requireActiveSession`
 * sorgt dafür, dass nur angemeldete Nutzer mit gültigem Zugang die
 * Erkennung auslösen können; sie kostet pro Aufruf Geld.
 */
export async function scanReceiptAction(
  _prevState: ScanState,
  formData: FormData,
): Promise<ScanState> {
  await requireActiveSession();

  if (!isScanConfigured()) {
    return {
      ...idleScanState,
      error:
        "Die Belegerkennung ist nicht eingerichtet. Dein Admin muss dafür einen Schlüssel hinterlegen.",
    };
  }

  const file = formData.get("beleg");
  if (!(file instanceof File) || file.size === 0) {
    return { ...idleScanState, error: "Kein Bild empfangen." };
  }

  // Das Foto wird im Browser bereits verkleinert; die Grenze fängt nur den
  // Fall ab, dass jemand die Aktion direkt aufruft.
  if (file.size > 5_000_000) {
    return { ...idleScanState, error: "Das Bild ist zu groß (max. 5 MB)." };
  }

  if (!isSupportedMediaType(file.type)) {
    return {
      ...idleScanState,
      error: "Dieses Bildformat wird nicht unterstützt. JPEG, PNG oder WebP funktionieren.",
    };
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await scanReceipt(base64, file.type);
    return { error: null, result };
  } catch (error) {
    // Der Fahrer kann mit einem API-Fehler nichts anfangen — er soll
    // wissen, dass er von Hand weitermachen kann.
    console.error("Belegerkennung fehlgeschlagen:", error);
    return {
      ...idleScanState,
      error: "Der Beleg konnte gerade nicht ausgelesen werden. Trag die Werte bitte von Hand ein.",
    };
  }
}
