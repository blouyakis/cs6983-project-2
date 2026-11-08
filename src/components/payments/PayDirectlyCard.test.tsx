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
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import type { Payment } from "@/lib/db/settlements";
import { PayDirectlyCard } from "./PayDirectlyCard";

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

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
const members = [
  { userId: ana, name: "Ana", defaultShareWeight: 1 },
  { userId: sam, name: "Sam", defaultShareWeight: 1 },
];

function card(groupMembers = members) {
  render(
    <NoticeProvider>
      <NoticeLine />
      <PayDirectlyCard
        groupId={groupId}
        members={groupMembers}
        currentUserId={ana}
      />
    </NoticeProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PayDirectlyCard", () => {
  it("says what it is for, with a Pay button", () => {
    card();

    expect(screen.getByText("Pay one person directly")).toBeInTheDocument();
    expect(
      screen.getByText("Between settle-ups, one payment at a time."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay/ })).toBeInTheDocument();
  });

  it("opens the payment form", () => {
    card();

    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));

    expect(
      screen.getByRole("dialog", { name: "Pay one person directly" }),
    ).toBeInTheDocument();
  });

  it("says who has to confirm once a payment is recorded, and refreshes the page", async () => {
    const payment: Payment = {
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
    mocks.postJson.mockResolvedValue({ ok: true, data: { payment } });
    card();

    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "8.83" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Recorded $8.83 to Sam. It counts once Sam confirms it.",
        ),
      ).toBeInTheDocument(),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("has no Pay button when there is nobody else to pay", () => {
    card(members.slice(0, 1));

    expect(screen.queryByRole("button", { name: /Pay/ })).toBeNull();
    expect(
      screen.getByText("There's nobody else in this group to pay yet."),
    ).toBeInTheDocument();
  });
});
