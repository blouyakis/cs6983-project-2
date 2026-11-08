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
import type { Payment } from "@/lib/db/settlements";
import { DirectPaymentForm } from "./DirectPaymentForm";

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
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const members = [
  { userId: ana, name: "Ana", defaultShareWeight: 1 },
  { userId: sam, name: "Sam", defaultShareWeight: 1 },
  { userId: jo, name: "Jo", defaultShareWeight: 1 },
];

const recorded: Payment = {
  id: "9c8d7e6f-6666-4777-8888-e99900001111",
  groupId,
  fromUserId: ana,
  toUserId: sam,
  amountCents: 883,
  status: "paid",
  settlementId: null,
  createdAt: "2026-11-02T10:00:00+00:00",
  paidAt: "2026-11-02T10:00:00+00:00",
  confirmedAt: null,
};

function form(groupMembers = members) {
  const onRecorded = vi.fn();
  const onClose = vi.fn();
  render(
    <DirectPaymentForm
      groupId={groupId}
      members={groupMembers}
      currentUserId={ana}
      open
      onClose={onClose}
      onRecorded={onRecorded}
    />,
  );
  return { onRecorded, onClose };
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DirectPaymentForm", () => {
  it("is titled Pay one person directly and offers every other member", () => {
    form();

    expect(
      screen.getByRole("dialog", { name: "Pay one person directly" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sam" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Jo" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Ana|You/ })).toBeNull();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });

  it("picks the only other member for you", () => {
    form(members.slice(0, 2));

    expect(screen.getByRole("radio", { name: "Sam" })).toBeChecked();
  });

  it("records the payment in cents to the chosen member", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { payment: recorded } });
    const { onRecorded, onClose } = form();

    fireEvent.click(screen.getByRole("radio", { name: "Sam" }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "8.83" },
    });
    submit();

    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith(recorded));
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/payments`,
      { toUserId: sam, amountCents: 883 },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("asks who you paid and how much before sending anything", async () => {
    form();

    submit();

    expect(await screen.findByText("Choose who you paid.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter an amount from $0.01 to $21,474,836.47."),
    ).toBeInTheDocument();
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it("refuses an amount of $0.00", async () => {
    form();

    fireEvent.click(screen.getByRole("radio", { name: "Sam" }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "0" },
    });
    submit();

    expect(
      await screen.findByText("Enter an amount from $0.01 to $21,474,836.47."),
    ).toBeInTheDocument();
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it("shows the server's field error next to the field", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { toUserId: "Choose a current member of this group." },
      },
    });
    const { onRecorded } = form();

    fireEvent.click(screen.getByRole("radio", { name: "Jo" }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "5" },
    });
    submit();

    expect(
      await screen.findByText("Choose a current member of this group."),
    ).toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("shows any other server message above the buttons", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "This group is archived." },
    });
    form();

    fireEvent.click(screen.getByRole("radio", { name: "Jo" }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "5" },
    });
    submit();

    expect(
      await screen.findByText("This group is archived."),
    ).toBeInTheDocument();
  });
});
