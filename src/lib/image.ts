/**
 * Verkleinert Fotos im Browser, bevor sie hochgeladen werden.
 *
 * Handyfotos sind oft 3–8 MB groß. Über Mobilfunk dauert der Upload dadurch
 * spürbar lange und kostet Datenvolumen — für ein Belegfoto reicht eine
 * deutlich kleinere Auflösung völlig aus.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.8;
/** Darunter lohnt das Umrechnen nicht. */
const SKIP_BELOW_BYTES = 400 * 1024;

export async function compressImage(file: File): Promise<File> {
  // PDFs und bereits kleine Dateien unverändert lassen.
  if (!file.type.startsWith("image/") || file.size < SKIP_BELOW_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Schon klein genug: nur neu kodieren, wenn dadurch etwas gewonnen wird.
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );

    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Kann das Gerät das Bild nicht dekodieren (z. B. exotisches HEIC),
    // wird es unverändert hochgeladen.
    return file;
  }
}

/**
 * Ersetzt die Datei in einem FormData-Feld durch die verkleinerte Fassung.
 * Gibt zurück, wie viel eingespart wurde — für die Anzeige im Formular.
 */
export async function compressFormFile(
  formData: FormData,
  field: string,
): Promise<{ originalBytes: number; compressedBytes: number } | null> {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) return null;

  const compressed = await compressImage(value);
  if (compressed === value) return null;

  formData.set(field, compressed);
  return { originalBytes: value.size, compressedBytes: compressed.size };
}
