import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

// jsdom has no showModal() or close(); see FormSheet.test.tsx.
const realShowModal = HTMLDialogElement.prototype.showModal;
const realClose = HTMLDialogElement.prototype.close;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterAll(() => {
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
});

type Props = Partial<Parameters<typeof ConfirmDialog>[0]>;

function renderDialog(props: Props = {}) {
  const onConfirm = props.onConfirm ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const view = render(
    <>
      <button type="button">Delete…</button>
      <ConfirmDialog
        open={props.open ?? true}
        message="Delete Groceries? Its $45.10 is removed from everyone's balance."
        confirmLabel="Delete expense"
        onConfirm={onConfirm}
        onCancel={onCancel}
        busy={props.busy}
      />
    </>,
  );
  return { ...view, onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is a dialog named by its one sentence, with Cancel and the action", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", {
      name: "Delete Groceries? Its $45.10 is removed from everyone's balance.",
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete expense" }),
    ).toBeInTheDocument();
  });

  it("shows nothing while closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gives Cancel focus when it opens, so Enter never confirms by accident", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("confirms with the action button and cancels with Cancel", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete expense" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("closes with Escape, and stops Escape there so an outer form stays open", () => {
    const { onCancel } = renderDialog();

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      screen.getByRole("dialog").dispatchEvent(event);
    });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("returns focus to the control that opened it when it closes", () => {
    const { rerender, onConfirm, onCancel } = renderDialog({ open: false });
    screen.getByRole("button", { name: "Delete…" }).focus();

    rerender(
      <>
        <button type="button">Delete…</button>
        <ConfirmDialog
          open
          message="Delete Groceries?"
          confirmLabel="Delete expense"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    rerender(
      <>
        <button type="button">Delete…</button>
        <ConfirmDialog
          open={false}
          message="Delete Groceries?"
          confirmLabel="Delete expense"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </>,
    );
    expect(screen.getByRole("button", { name: "Delete…" })).toHaveFocus();
  });

  // A browser fires close a task after dialog.close(). If the dialog was
  // opened again in between, as a quick Escape then Enter does, that late
  // event must not cancel the new question.
  it("ignores a close event that arrives after it has opened again", () => {
    const { onCancel } = renderDialog();

    act(() => {
      screen.getByRole("dialog").dispatchEvent(new Event("close"));
    });

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables the action while busy, so it isn't sent twice", () => {
    renderDialog({ busy: true });

    expect(
      screen.getByRole("button", { name: "Delete expense" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  // The action is already on its way, so Cancel can't stop it. It says so
  // with aria-disabled instead of disabled, so focus still has a place to
  // stay inside the dialog while the action button is off.
  it("marks Cancel unavailable while busy and does nothing when it is pressed", () => {
    const { onCancel } = renderDialog({ busy: true });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    fireEvent.click(cancel);

    expect(cancel).toHaveAttribute("aria-disabled", "true");
    expect(cancel).toHaveFocus();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
