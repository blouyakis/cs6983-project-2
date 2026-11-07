"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";

type ConfirmDialogProps = {
  open: boolean;
  // One sentence saying what will happen, such as "Uncheck Milk? This
  // deletes its $5.00 expense."
  message: string;
  // Names the action: "Uncheck and delete", "Delete expense".
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  // While the action is being sent, so it isn't sent twice.
  busy?: boolean;
};

// Asks before an action that can't be undone with one click (DESIGN.md
// "ConfirmDialog"). A small dialog, not a form, so it doesn't use FormSheet.
// Cancel has focus when it opens, Tab stays inside, Escape or Cancel closes
// it, and focus goes back to the control that opened it.
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const messageId = useId();

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
      cancelRef.current?.focus();
    } else if (!open) {
      if (dialog.open) {
        dialog.close();
      }
      openerRef.current?.focus();
      openerRef.current = null;
    }
  }, [open]);

  // The action button had focus when it was pressed, and turning it off sends
  // focus to body in a browser. Cancel is the one control left in the dialog.
  useEffect(() => {
    if (open && busy) {
      cancelRef.current?.focus();
    }
  }, [open, busy]);

  // Escape closes this layer only: preventDefault tells an enclosing
  // FormSheet that this Escape was used (see its handleKeyDown).
  // While busy, ignore Escape to prevent the dialog closing mid-request.
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      if (event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!busy) {
        onCancel();
      }
    } else if (event.key === "Tab") {
      const buttons = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])",
        ),
      );
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (!busy) {
      onCancel();
    }
  }

  // A browser fires close a task after dialog.close(). If the dialog was
  // shown again in between (Escape, then a quick Enter on the same button),
  // it is open now, and that late event must not cancel the new question.
  function handleClose() {
    if (open && !dialogRef.current?.open) {
      onCancel();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={messageId}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-4 border-ink bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      {open ? (
        <div className="flex flex-col gap-4 p-4">
          <p id={messageId} className="font-semibold">
            {message}
          </p>
          <div className="flex justify-end gap-3">
            <button
              ref={cancelRef}
              type="button"
              // While busy the action is on its way and Cancel can't stop it.
              // aria-disabled, not disabled, keeps it focusable, so focus can
              // move here and stay in the dialog while the action button is
              // off.
              aria-disabled={busy || undefined}
              onClick={busy ? undefined : onCancel}
              className="rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold aria-disabled:bg-disabled"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="rounded-lg border-2 border-ink bg-owe px-4 py-2 font-semibold text-white shadow-[3px_3px_0_0_var(--color-ink)] disabled:bg-disabled disabled:text-ink disabled:shadow-none"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
