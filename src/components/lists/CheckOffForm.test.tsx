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
import type { Member } from "@/lib/db/group-members";
import type { ListItem } from "@/lib/db/list-items";
import { CheckOffForm } from "./CheckOffForm";

const mocks = vi.hoisted(() => ({ postJson: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));

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

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

const milk: ListItem = {
  id: "1d5a6182-3333-4444-8555-b66677778888",
  groupId,
  title: "🥛 Milk",
  quantity: null,
  note: null,
  estimatedCents: 450,
  status: "open",
  addedBy: ana,
  completedBy: null,
  completedAt: null,
  expenseId: null,
  createdAt: "2026-11-04T18:00:00+00:00",
};

const members: Member[] = [
  { userId: ana, name: "Ana", defaultShareWeight: 1 },
  { userId: sam, name: "Sam", defaultShareWeight: 1 },
];

function setup({ isPersonal = false } = {}) {
  const onClose = vi.fn();
  const onCheckedOff = vi.fn();
  const onRefused = vi.fn();
  render(
    <CheckOffForm
      item={milk}
      open
      groupId={groupId}
      isPersonal={isPersonal}
      members={isPersonal ? [members[0]] : members}
      currentUserId={ana}
      onClose={onClose}
      onCheckedOff={onCheckedOff}
      onRefused={onRefused}
    />,
  );
  return { onClose, onCheckedOff, onRefused };
}

function typeCost(text: string) {
  fireEvent.change(screen.getByLabelText("Actual cost"), {
    target: { value: text },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Check off" }));
}

const done = { ...milk, status: "done", completedBy: ana };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CheckOffForm (#12)", () => {
  it("is named for the item", () => {
    setup();

    expect(
      screen.getByRole("dialog", { name: "Check off Milk" }),
    ).toBeInTheDocument();
  });

  it("sends the cost and an even split among everyone by default", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { item: done } });
    const { onCheckedOff, onClose } = setup();

    typeCost("12.34");
    submit();

    await waitFor(() => expect(onCheckedOff).toHaveBeenCalledWith(milk, 1234));
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/list-items/${milk.id}/complete`,
      { amountCents: 1234, mode: "even", sharedBy: [ana, sam] },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("sends only the people chosen to share it", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { item: done } });
    setup();

    typeCost("5");
    fireEvent.click(screen.getByRole("checkbox", { name: "Sam" }));
    submit();

    await waitFor(() => expect(mocks.postJson).toHaveBeenCalled());
    expect(mocks.postJson.mock.calls[0][1]).toEqual({
      amountCents: 500,
      mode: "even",
      sharedBy: [ana],
    });
  });

  it("checks off an item that cost nothing when the cost is left blank", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { item: done } });
    const { onCheckedOff } = setup();

    submit();

    await waitFor(() => expect(onCheckedOff).toHaveBeenCalledWith(milk, 0));
    expect(mocks.postJson.mock.calls[0][1]).toMatchObject({ amountCents: 0 });
  });

  it("asks for a cost it can read before sending anything", async () => {
    setup();

    typeCost("twelve");
    submit();

    expect(
      await screen.findByText(/Enter the cost in dollars and cents/),
    ).toBeInTheDocument();
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it("has no split in the personal space and logs it all to the owner (#23)", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { item: done } });
    setup({ isPersonal: true });

    expect(screen.queryByText("How is it split?")).not.toBeInTheDocument();
    typeCost("5");
    submit();

    await waitFor(() => expect(mocks.postJson).toHaveBeenCalled());
    expect(mocks.postJson.mock.calls[0][1]).toEqual({
      amountCents: 500,
      mode: "even",
      sharedBy: [ana],
    });
  });

  it("shows a field error from the server next to the field", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { amountCents: "Enter an amount from $0.00." },
      },
    });
    const { onRefused, onCheckedOff } = setup();

    typeCost("5");
    submit();

    expect(
      await screen.findByText("Enter an amount from $0.00."),
    ).toBeInTheDocument();
    expect(onRefused).not.toHaveBeenCalled();
    expect(onCheckedOff).not.toHaveBeenCalled();
  });

  it("says why when the server refuses, and lets the list catch up", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "This item is already checked off." },
    });
    const { onRefused } = setup();

    typeCost("5");
    submit();

    expect(
      await screen.findByText("This item is already checked off."),
    ).toBeInTheDocument();
    expect(onRefused).toHaveBeenCalled();
  });
});
