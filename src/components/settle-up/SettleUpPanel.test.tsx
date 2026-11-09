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
import type { SettleUp } from "@/lib/services/settlement-service";
import { SettleUpPanel } from "./SettleUpPanel";

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

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
const names = { [ana]: "Ana", [sam]: "Sam", [jo]: "Jo" };

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "9c8d7e6f-6666-4777-8888-e99900001111",
    groupId,
    fromUserId: ana,
    toUserId: sam,
    amountCents: 3100,
    status: "suggested",
    settlementId: "5e6f7a8b-5555-4666-8777-d88899990000",
    createdAt: "2026-11-01T10:00:00+00:00",
    paidAt: null,
    confirmedAt: null,
    ...overrides,
  };
}

function settleUp(payments: Payment[]): SettleUp {
  return {
    id: "5e6f7a8b-5555-4666-8777-d88899990000",
    groupId,
    status: "open",
    startedBy: ana,
    startedAt: "2026-11-01T10:00:00+00:00",
    closedAt: null,
    payments,
  };
}

function panel(
  current: SettleUp | null,
  viewer = ana,
  overrides: Partial<{ readOnly: boolean; memberCount: number }> = {},
) {
  render(
    <NoticeProvider>
      <NoticeLine />
      <SettleUpPanel
        groupId={groupId}
        settleUp={current}
        names={names}
        currentUserId={viewer}
        memberCount={overrides.memberCount ?? 3}
        readOnly={overrides.readOnly ?? false}
      />
    </NoticeProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SettleUpPanel", () => {
  describe("with no settle-up open", () => {
    it("offers to start one and refreshes with a notice once it is started", async () => {
      mocks.postJson.mockResolvedValue({
        ok: true,
        data: { settleUp: settleUp([payment({}), payment({ id: "p2" })]) },
      });
      panel(null);

      expect(screen.getByText("No settle-up is open.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Start settle-up/ }));

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${groupId}/settlements`,
        {},
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Settle-up started: 2 payments to make.",
      );
    });

    it("says the period closed at once when there was nothing to pay", async () => {
      mocks.postJson.mockResolvedValue({
        ok: true,
        data: {
          settleUp: {
            ...settleUp([]),
            status: "closed",
            closedAt: "2026-11-01T10:00:00+00:00",
          },
        },
      });
      panel(null);

      fireEvent.click(screen.getByRole("button", { name: /Start settle-up/ }));

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      expect(screen.getByRole("status")).toHaveTextContent(
        "Everyone was settled up, so the period closed.",
      );
    });

    it("shows the server's message when starting fails, and still refreshes", async () => {
      mocks.postJson.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "A settle-up is already open." },
      });
      panel(null);

      fireEvent.click(screen.getByRole("button", { name: /Start settle-up/ }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "A settle-up is already open.",
        ),
      );
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it("offers nothing to a read-only viewer", () => {
      panel(null, ana, { readOnly: true });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByText("No settle-up is open.")).toBeInTheDocument();
    });
  });

  describe("with a settle-up open", () => {
    it("lists the payments with how many were saved", () => {
      panel(settleUp([payment({}), payment({ id: "p2", fromUserId: jo })]));

      expect(
        screen.getByRole("heading", { name: /Fewest payments/ }),
      ).toBeInTheDocument();
      expect(screen.getByText("2 payments, not 6")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("uses the singular for one payment", () => {
      panel(settleUp([payment({})]), ana, { memberCount: 2 });

      expect(screen.getByText("1 payment, not 2")).toBeInTheDocument();
    });

    it("lets the sender mark a payment paid, then refreshes with a notice", async () => {
      const paid = payment({ status: "paid", paidAt: "2026-11-02T10:00:00Z" });
      mocks.postJson.mockResolvedValue({ ok: true, data: { payment: paid } });
      panel(settleUp([payment({})]));

      fireEvent.click(screen.getByRole("button", { name: /I paid this/ }));

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${groupId}/payments/${paid.id}/paid`,
        {},
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Marked paid. Sam can confirm it now.",
      );
    });

    it("lets the recipient confirm, and says when the period closed", async () => {
      const paid = payment({ status: "paid", paidAt: "2026-11-02T10:00:00Z" });
      mocks.postJson.mockResolvedValue({
        ok: true,
        data: { payment: { ...paid, status: "confirmed" }, closed: true },
      });
      panel(settleUp([paid]), sam);

      fireEvent.click(screen.getByRole("button", { name: /I got it/ }));

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${groupId}/payments/${paid.id}/confirm`,
        {},
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Confirmed. That was the last one: the period is closed.",
      );
    });

    it("says what is still waiting when the period stays open", async () => {
      const paid = payment({ status: "paid", paidAt: "2026-11-02T10:00:00Z" });
      mocks.postJson.mockResolvedValue({
        ok: true,
        data: { payment: { ...paid, status: "confirmed" }, closed: false },
      });
      panel(settleUp([paid, payment({ id: "p2", fromUserId: jo })]), sam);

      fireEvent.click(screen.getByRole("button", { name: /I got it/ }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Confirmed. The period closes when every payment is confirmed.",
        ),
      );
    });

    it("shows the server's message when an action fails", async () => {
      mocks.postJson.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "Already marked paid." },
      });
      panel(settleUp([payment({})]));

      fireEvent.click(screen.getByRole("button", { name: /I paid this/ }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Already marked paid.",
        ),
      );
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it("asks before cancelling while every payment is suggested, then cancels", async () => {
      mocks.postJson.mockResolvedValue({ ok: true, data: undefined });
      panel(settleUp([payment({})]), jo);

      fireEvent.click(screen.getByRole("button", { name: "Cancel settle-up" }));
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent(/Cancel this settle-up\?/);
      fireEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }));

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${groupId}/settlements/current/cancel`,
        {},
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Settle-up cancelled. The costs stay unsettled.",
      );
    });

    it("can't be cancelled once a payment is marked paid", () => {
      panel(
        settleUp([payment({ status: "paid", paidAt: "2026-11-02T10:00:00Z" })]),
        jo,
      );

      expect(
        screen.queryByRole("button", { name: "Cancel settle-up" }),
      ).not.toBeInTheDocument();
    });

    // #108: the recipient declines a paid payment after a ConfirmDialog.
    it("asks before the recipient declines a paid payment, then declines it", async () => {
      const paid = payment({ status: "paid", paidAt: "2026-11-02T10:00:00Z" });
      mocks.postJson.mockResolvedValue({
        ok: true,
        data: { payment: { ...paid, status: "suggested", paidAt: null } },
      });
      panel(settleUp([paid]), sam);

      fireEvent.click(screen.getByRole("button", { name: /I didn't get it/ }));
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "Didn't get $31.00 from Ana? It goes back to suggested, so Ana can mark it paid again once it's sent.",
      );
      expect(mocks.postJson).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Decline payment" }));

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${groupId}/payments/${paid.id}/decline`,
        {},
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Declined. Ana can mark it paid again once it's sent.",
      );
    });

    it("sends nothing when the recipient changes their mind", () => {
      const paid = payment({ status: "paid", paidAt: "2026-11-02T10:00:00Z" });
      panel(settleUp([paid]), sam);

      fireEvent.click(screen.getByRole("button", { name: /I didn't get it/ }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mocks.postJson).not.toHaveBeenCalled();
    });

    it("shows the server's message when declining fails", async () => {
      const paid = payment({ status: "paid", paidAt: "2026-11-02T10:00:00Z" });
      mocks.postJson.mockResolvedValue({
        ok: false,
        error: {
          code: "CONFLICT",
          message: "This payment is already confirmed.",
        },
      });
      panel(settleUp([paid]), sam);

      fireEvent.click(screen.getByRole("button", { name: /I didn't get it/ }));
      fireEvent.click(screen.getByRole("button", { name: "Decline payment" }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "This payment is already confirmed.",
        ),
      );
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it("gives a read-only viewer the cards without buttons", () => {
      panel(settleUp([payment({})]), ana, { readOnly: true });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
  });
});
