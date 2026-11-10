"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action";

type Toast = { id: number; kind: "success" | "error"; text: string };
type ToastApi = { success: (text: string) => void; error: (text: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (t) => push("success", t), error: (t) => push("error", t) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex max-w-sm animate-toast items-center gap-2.5 rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-ink shadow-xl shadow-black/50"
          >
            {t.kind === "error" ? (
              <CircleAlert size={16} className="shrink-0 text-danger" />
            ) : (
              <CircleCheck size={16} className="shrink-0 text-good" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast muss innerhalb von <ToastProvider> verwendet werden.");
  return ctx;
}

/**
 * Führt eine Server Action in einer Transition aus und meldet Fehler als Toast.
 * `pending` bleibt wahr, bis auch die neu geladenen Seitendaten angekommen sind.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const run = useCallback(
    <T,>(
      call: () => Promise<ActionResult<T>>,
      options: { success?: string; onSuccess?: (data: T) => void; optimistic?: () => void } = {},
    ) => {
      startTransition(async () => {
        options.optimistic?.();
        try {
          const result = await call();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          if (options.success) toast.success(options.success);
          options.onSuccess?.(result.data);
        } catch (error) {
          // Weiterleitungen (z. B. nach dem Löschen des Kontos) nicht als Fehler behandeln.
          if (error && typeof error === "object" && "digest" in error) throw error;
          toast.error("Keine Verbindung zum Server. Bitte versuche es erneut.");
        }
      });
    },
    [toast],
  );

  return { run, pending };
}
