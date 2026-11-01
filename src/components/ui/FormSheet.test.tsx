import { fireEvent, render, screen } from "@testing-library/react";
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

  it("moves focus to the first field when it opens", () => {
    renderSheet();
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
  });
});
