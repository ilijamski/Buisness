import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

export const zId = z.uuid("Ungültige Kennung.");
export const zOptionalId = z.union([zId, z.literal(""), z.null()]).transform((v) => v || null);
export const zDate = z.string().refine(isIsoDate, "Bitte ein gültiges Datum wählen.");
export const zOptionalDate = z.union([zDate, z.literal(""), z.null()]).transform((v) => v || null);
export const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Bitte eine gültige Uhrzeit wählen.");
export const zOptionalTime = z.union([zTime, z.literal(""), z.null()]).transform((v) => v || null);
export const zTitle = z.string().trim().min(1, "Bitte einen Titel eingeben.").max(200, "Der Titel ist zu lang.");
export const zText = z.string().trim().max(5000, "Der Text ist zu lang.").default("");
export const zColor = z.number().int().min(1).max(8).default(1);
