import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { getClock, getUser } from "@/lib/auth/session";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

type Ctx = { db: Db; userId: string; today: string };

/**
 * Hülle für alle schreibenden Server Actions: prüft die Anmeldung, validiert
 * die Eingabe mit zod, fängt Fehler ab und lässt die Seiten neu rendern.
 * Server Actions sind per POST direkt erreichbar – jede Action läuft hier durch.
 */
export function userAction<S extends z.ZodType, R = undefined>(
  schema: S,
  handler: (input: z.output<S>, ctx: Ctx) => Promise<R>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    const user = await getUser();
    if (!user) return { ok: false, error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
    }
    try {
      const [db, clock] = await Promise.all([getDb(), getClock()]);
      const data = await handler(parsed.data, { db, userId: user.id, today: clock.today });
      revalidatePath("/", "layout");
      return { ok: true, data };
    } catch (error) {
      unstable_rethrow(error); // redirect() & Co. durchreichen
      if (error instanceof UserError) return { ok: false, error: error.message };
      console.error("[action]", error);
      return { ok: false, error: "Das hat nicht geklappt. Bitte versuche es erneut." };
    }
  };
}

/** Fehler, dessen Meldung dem Nutzer angezeigt werden darf. */
export class UserError extends Error {}
