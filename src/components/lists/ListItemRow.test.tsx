import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ListItem } from "@/lib/db/list-items";
import { ListItemRow } from "./ListItemRow";

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

const towels: ListItem = {
  id: "1d5a6182-3333-4444-8555-b66677778888",
  groupId,
  title: "🧻 Paper towels",
  quantity: null,
  note: null,
  estimatedCents: 1200,
  status: "open",
  addedBy: anaId,
  completedBy: null,
  completedAt: null,
  createdAt: "2026-11-02T18:00:00+00:00",
};

function renderRow(
  item: ListItem,
  props: Partial<Parameters<typeof ListItemRow>[0]> = {},
) {
  return render(
    <ul>
      <ListItemRow
        item={item}
        addedByName="Sam"
        completedByName={null}
        isPersonal={false}
        {...props}
      />
    </ul>,
  );
}

describe("ListItemRow", () => {
  it("shows the title with its emoji hidden from screen readers", () => {
    renderRow(towels);

    expect(screen.getByText("Paper towels")).toBeInTheDocument();
    expect(screen.getByText("🧻")).toHaveAttribute("aria-hidden", "true");
  });

  it("says who added an open item and its estimate", () => {
    renderRow(towels);

    expect(screen.getByText("added by Sam · est. $12.00")).toBeInTheDocument();
    expect(screen.getByText("~$12.00")).toBeInTheDocument();
  });

  it("shows a dash and says no cost for an item with no estimate", () => {
    renderRow({ ...towels, title: "Take out recycling", estimatedCents: null });

    expect(screen.getByText("added by Sam · no cost")).toBeInTheDocument();
    expect(screen.getByText("—")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the quantity and the note", () => {
    renderRow({ ...towels, quantity: 2, note: "The big rolls" });

    expect(screen.getByText("× 2")).toBeInTheDocument();
    expect(screen.getByText("The big rolls")).toBeInTheDocument();
  });

  it("says when an item was added in the personal space, not who added it", () => {
    renderRow(towels, { isPersonal: true });

    expect(screen.getByText("Added Nov 2 · est. $12.00")).toBeInTheDocument();
  });

  it("has a checkbox named for the item that waits for checking off (#12)", () => {
    renderRow(towels);

    const checkbox = screen.getByRole("checkbox", {
      name: "Check off Paper towels",
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeDisabled();
  });

  it("offers edit and delete buttons named for the item", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderRow(towels, { onEdit, onDelete });

    fireEvent.click(screen.getByRole("button", { name: "Edit Paper towels" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Paper towels" }),
    );

    expect(onEdit).toHaveBeenCalledWith(towels);
    expect(onDelete).toHaveBeenCalledWith(towels);
  });

  it("offers no buttons in a read-only list", () => {
    renderRow(towels);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("a done item", () => {
    const done: ListItem = {
      ...towels,
      status: "done",
      completedBy: anaId,
      completedAt: "2026-11-03T12:00:00+00:00",
    };

    it("is checked, struck through, and says who completed it and when", () => {
      renderRow(done, {
        completedByName: "You",
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });

      expect(
        screen.getByRole("checkbox", { name: "Paper towels is done" }),
      ).toBeChecked();
      expect(screen.getByText("Paper towels")).toHaveClass("line-through");
      expect(screen.getByText("✔ You · Nov 3")).toBeInTheDocument();
    });

    it("can't be edited or deleted until it is unchecked", () => {
      renderRow(done, {
        completedByName: "You",
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
