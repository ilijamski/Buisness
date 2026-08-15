/**
 * Gemeinsamer Rückgabetyp für Server Actions.
 *
 * Bewusst außerhalb der "use server"-Dateien: dort dürfen ausschließlich
 * async-Funktionen exportiert werden, keine Konstanten oder Typen.
 */
export type ActionState = { error: string | null; success: boolean };

export const idleState: ActionState = { error: null, success: false };
