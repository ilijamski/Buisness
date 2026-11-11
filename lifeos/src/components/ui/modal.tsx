"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button, IconButton } from "./primitives";

/**
 * Dialog auf Basis des nativen <dialog>: Fokusfalle, Escape und Top-Layer
 * kommen vom Browser. Auf dem Smartphone erscheint er als Sheet am unteren Rand.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "modal m-0 mt-auto w-full max-w-none rounded-t-2xl border border-line-strong bg-raised p-0 text-ink shadow-2xl shadow-black/60 sm:m-auto sm:rounded-2xl",
        "max-h-[92dvh] sm:max-h-[86dvh]",
        size === "sm" ? "sm:max-w-sm" : "sm:max-w-lg",
      )}
      // Nur Escape meldet sich hier; das Schließen selbst läuft über die `open`-Eigenschaft.
      // (Das native close-Ereignis feuert auch beim programmatischen Schließen.)
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line py-3 pr-3 pl-5">
            <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>
            <IconButton label="Schließen" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </header>
          <div className="overflow-y-auto p-5">{children}</div>
          {footer ? (
            <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Formular-Dialog: Absenden per Enter, Fußzeile mit Speichern/Abbrechen/Löschen. */
export function FormModal({
  open,
  onClose,
  title,
  children,
  onSubmit,
  onDelete,
  pending,
  submitLabel = "Speichern",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  onDelete?: () => void;
  pending?: boolean;
  submitLabel?: string;
}) {
  const formId = `form-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          {onDelete ? (
            <Button variant="danger" onClick={onDelete} disabled={pending} className="mr-auto">
              Löschen
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={pending}>
            {pending ? "Speichert …" : submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        {children}
      </form>
    </Modal>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = "Löschen",
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: string;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-pretty text-ink-2">{text}</p>
    </Modal>
  );
}
