"use client";

import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { PrimaryButton } from "./PrimaryButton";

type FormSheetProps = {
  open: boolean;
  title: string;
  primaryLabel: string;
  onSubmit: (data: FormData) => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string;
  children: ReactNode;
};

const FIELDS = "input:not([type=hidden]), select, textarea";

// Holds every form (DESIGN.md "Components"). Full screen on a phone, a dialog
// on desktop. showModal() puts it on top and makes the page behind it inert.
export function FormSheet({
  open,
  title,
  primaryLabel,
  onSubmit,
  onClose,
  children,
}: FormSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>(FIELDS)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      openerRef.current?.focus();
      openerRef.current = null;
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  // The parent owns `open`, so Escape asks it to close instead of letting the
  // browser close the dialog behind React's back.
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
      className="m-0 h-full max-h-none w-full max-w-none bg-surface p-0 text-ink backdrop:bg-ink/40 md:m-auto md:h-auto md:max-h-[85vh] md:max-w-lg md:rounded-2xl md:border-4 md:border-ink"
    >
      {open ? (
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <header className="flex items-center gap-3 border-b-2 border-dashed border-divider px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg border-2 border-ink bg-surface px-3 py-1 text-lg leading-none"
            >
              <span aria-hidden="true">✕</span>
            </button>
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
          </header>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {children}
          </div>
          <footer className="flex justify-end gap-3 border-t-2 border-dashed border-divider px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold"
            >
              Cancel
            </button>
            <PrimaryButton type="submit">{primaryLabel}</PrimaryButton>
          </footer>
        </form>
      ) : null}
    </dialog>
  );
}
