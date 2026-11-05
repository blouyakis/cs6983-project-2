import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ListItem } from "@/lib/db/list-items";
import { EditListItemForm } from "./EditListItemForm";

const mocks = vi.hoisted(() => ({ patchJson: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ patchJson: mocks.patchJson }));

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

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const milk: ListItem = {
  id: "1d5a6182-3333-4444-8555-b66677778888",
  groupId,
  title: "🥛 Milk",
  quantity: 2,
  note: "Oat",
  estimatedCents: 450,
  status: "open",
  addedBy: "6f1c2d4e-1111-4222-8333-944455556666",
  completedBy: null,
  completedAt: null,
  createdAt: "2026-11-04T18:00:00+00:00",
};

function setup() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <EditListItemForm item={milk} open onClose={onClose} onSaved={onSaved} />,
  );
  return { onClose, onSaved };
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("EditListItemForm", () => {
  it("opens filled in with the item as it is", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "Edit item" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("What is it?")).toHaveValue("🥛 Milk");
    expect(screen.getByLabelText("Estimated cost")).toHaveValue("4.50");
    expect(screen.getByLabelText("Quantity")).toHaveValue("2");
    expect(screen.getByLabelText("Note")).toHaveValue("Oat");
  });

  it("saves every field and reports the edited item", async () => {
    const edited = { ...milk, estimatedCents: null };
    mocks.patchJson.mockResolvedValue({ ok: true, data: { item: edited } });
    const { onSaved, onClose } = setup();

    fireEvent.change(screen.getByLabelText("Estimated cost"), {
      target: { value: "" },
    });
    save();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(edited));
    expect(mocks.patchJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/list-items/${milk.id}`,
      { title: "🥛 Milk", quantity: 2, note: "Oat", estimatedCents: null },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a mistake next to its field without sending", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "0" },
    });
    save();

    expect(screen.getByLabelText("Quantity")).toHaveAccessibleDescription(
      expect.stringContaining("Enter a quantity of 1 or more"),
    );
    expect(mocks.patchJson).not.toHaveBeenCalled();
  });

  it("says so above the buttons when someone checked it off first", async () => {
    mocks.patchJson.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "This item is done. Uncheck it first to change it.",
      },
    });
    const { onSaved, onClose } = setup();

    save();

    expect(
      await screen.findByText(
        "This item is done. Uncheck it first to change it.",
      ),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
