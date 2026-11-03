import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FormSheet } from "./FormSheet";
import { TextField } from "./TextField";

// jsdom has no showModal() or close() (#56), so stand in for them here. The
// real browser behavior is checked by hand and, from #6, by Playwright.
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

type Props = Partial<Parameters<typeof FormSheet>[0]>;

function renderSheet(props: Props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const view = render(
    <FormSheet
      open={props.open ?? true}
      title="New group"
      primaryLabel="Create group"
      onSubmit={onSubmit}
      onClose={onClose}
      submitting={props.submitting}
      error={props.error}
    >
      <TextField label="Name" name="name" defaultValue="Dorm 4B" />
      <TextField label="Note" name="note" />
    </FormSheet>,
  );
  return { ...view, onSubmit, onClose };
}

describe("FormSheet", () => {
  it("is a dialog named by its title", () => {
    renderSheet();
    expect(
      screen.getByRole("dialog", { name: "New group" }),
    ).toBeInTheDocument();
  });

  it("shows nothing while it is closed", () => {
    renderSheet({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  // jsdom doesn't make the page inert, so only check that showModal() is what
  // opens it. Playwright checks the inert page in a real browser.
  it("opens as a modal so the page behind it is inert", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    try {
      renderSheet();
      expect(showModal).toHaveBeenCalledTimes(1);
    } finally {
      showModal.mockRestore();
    }
  });

  it("moves focus to the first field when it opens", () => {
    renderSheet();
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  // Such as the payer on an edit form, which can't be changed (AGENTS.md 6.7).
  it("skips a disabled first field when it moves focus", () => {
    render(
      <FormSheet
        open
        title="Edit expense"
        primaryLabel="Save"
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      >
        <TextField label="Paid by" name="payer" defaultValue="Sam" disabled />
        <TextField label="Name" name="name" defaultValue="Groceries" />
      </FormSheet>,
    );
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("names the icon-only close button Close", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("has Cancel and one primary button", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(
      screen.getByRole("button", { name: "Create group" }),
    ).toHaveAttribute("type", "submit");
  });

  it("calls onSubmit once with the form's data when the primary button is pressed", () => {
    const { onSubmit } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const data = vi.mocked(onSubmit).mock.calls[0][0];
    expect(data).toBeInstanceOf(FormData);
    expect(data.get("name")).toBe("Dorm 4B");
  });

  it("calls onSubmit once when the form is submitted from a field, as Enter does", () => {
    const { onSubmit } = renderSheet();
    const form = screen.getByLabelText("Name").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  describe("errors and submitting", () => {
    it("announces a form-level error in a polite live region", () => {
      renderSheet({ error: "You already have a group with that name." });
      const error = screen.getByText(
        "You already have a group with that name.",
      );
      expect(error).toHaveAttribute("aria-live", "polite");
      expect(screen.getByRole("dialog")).toContainElement(error);
    });

    it("has the live region in place before there is an error", () => {
      // A screen reader only announces text added to a region it already
      // knows, so the region must exist before the error arrives.
      renderSheet();
      const regions = screen
        .getByRole("dialog")
        .querySelectorAll(":scope > form > [aria-live='polite']");
      expect(regions).toHaveLength(1);
      expect(regions[0]).toBeEmptyDOMElement();
    });

    it("disables the primary button while submitting", () => {
      renderSheet({ submitting: true });
      expect(
        screen.getByRole("button", { name: "Create group" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    });

    it("ignores a second submit, such as Enter, while submitting", () => {
      const { onSubmit } = renderSheet({ submitting: true });
      const form = screen.getByLabelText("Name").closest("form");
      fireEvent.submit(form as HTMLFormElement);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("skips a disabled primary button when wrapping backwards", () => {
      renderSheet({ submitting: true });
      const first = screen.getByRole("button", { name: "Close" });
      first.focus();
      fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });
  });

  describe("keeping focus inside", () => {
    // In order: Close, Name, Note, Cancel, Create group.
    it("moves Tab from the last element to the first", () => {
      renderSheet();
      const last = screen.getByRole("button", { name: "Create group" });
      last.focus();
      const notPrevented = fireEvent.keyDown(last, { key: "Tab" });
      expect(notPrevented).toBe(false);
      expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    });

    it("moves Shift+Tab from the first element to the last", () => {
      renderSheet();
      const first = screen.getByRole("button", { name: "Close" });
      first.focus();
      const notPrevented = fireEvent.keyDown(first, {
        key: "Tab",
        shiftKey: true,
      });
      expect(notPrevented).toBe(false);
      expect(
        screen.getByRole("button", { name: "Create group" }),
      ).toHaveFocus();
    });

    it("leaves Tab between the other elements to the browser", () => {
      renderSheet();
      const field = screen.getByLabelText("Name");
      expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(true);
      expect(fireEvent.keyDown(field, { key: "Tab", shiftKey: true })).toBe(
        true,
      );
      expect(field).toHaveFocus();
    });
  });

  describe("closing", () => {
    it("calls onClose when Escape is pressed", () => {
      const { onClose } = renderSheet();
      fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose instead of letting the browser close it on cancel", () => {
      const { onClose } = renderSheet();
      const cancel = new Event("cancel", { cancelable: true });
      fireEvent(screen.getByRole("dialog"), cancel);
      expect(cancel.defaultPrevented).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it.each(["Cancel", "Close"])("calls onClose when %s is pressed", (name) => {
      const { onClose, onSubmit } = renderSheet();
      fireEvent.click(screen.getByRole("button", { name }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            New group
          </button>
          <FormSheet
            open={open}
            title="New group"
            primaryLabel="Create group"
            onSubmit={() => setOpen(false)}
            onClose={() => setOpen(false)}
          >
            <TextField label="Name" name="name" />
          </FormSheet>
        </>
      );
    }

    it.each([
      [
        "Escape",
        (field: HTMLElement) => fireEvent.keyDown(field, { key: "Escape" }),
      ],
      [
        "Cancel",
        () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })),
      ],
      [
        "Close",
        () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
      ],
    ])("returns focus to the opener after %s", (_name, close) => {
      render(<Opener />);
      const opener = screen.getByRole("button", { name: "New group" });
      opener.focus();
      fireEvent.click(opener);
      const field = screen.getByLabelText("Name");
      expect(field).toHaveFocus();

      close(field);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });

    // Chrome can close a modal dialog on a second Escape without firing a
    // cancelable cancel event, so the dialog closes behind React's back.
    function closeLikeTheBrowser() {
      act(() => {
        (screen.getByRole("dialog") as HTMLDialogElement).close();
      });
    }

    it("calls onClose when the browser closes it without a cancel event", () => {
      const { onClose } = renderSheet();
      closeLikeTheBrowser();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when the parent closes it", () => {
      const { onClose, rerender } = renderSheet();
      rerender(
        <FormSheet
          open={false}
          title="New group"
          primaryLabel="Create group"
          onSubmit={vi.fn()}
          onClose={onClose}
        >
          <TextField label="Name" name="name" />
        </FormSheet>,
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it("returns focus to the opener and opens again after the browser closes it", () => {
      render(<Opener />);
      const opener = screen.getByRole("button", { name: "New group" });
      opener.focus();
      fireEvent.click(opener);

      closeLikeTheBrowser();

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
      fireEvent.click(opener);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveFocus();
    });
  });
});
