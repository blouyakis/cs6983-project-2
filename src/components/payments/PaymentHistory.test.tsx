import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
import { PaymentHistory } from "./PaymentHistory";

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
    amountCents: 883,
    status: "paid",
    settlementId: null,
    createdAt: "2026-11-02T10:00:00+00:00",
    paidAt: "2026-11-02T10:00:00+00:00",
    confirmedAt: null,
    ...overrides,
  };
}

function history(payments: Payment[], viewer = ana, readOnly = false) {
  render(
    <NoticeProvider>
      <NoticeLine />
      <PaymentHistory
        groupId={groupId}
        payments={payments}
        names={names}
        currentUserId={viewer}
        readOnly={readOnly}
      />
    </NoticeProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PaymentHistory", () => {
  it("says so when nobody has paid anyone yet", () => {
    history([]);

    expect(
      screen.getByRole("heading", { name: "Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No payments yet.")).toBeInTheDocument();
  });

  it("lists each payment with who paid whom, the amount, the day and its status in words", () => {
    history([
      payment({}),
      payment({
        id: "1111aaaa-6666-4777-8888-e99900001111",
        fromUserId: jo,
        toUserId: ana,
        amountCents: 1200,
        status: "confirmed",
        paidAt: "2026-11-01T10:00:00+00:00",
        confirmedAt: "2026-11-01T12:00:00+00:00",
      }),
    ]);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("You → Sam")).toBeInTheDocument();
    expect(within(rows[0]).getByText("$8.83")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Nov 2/)).toBeInTheDocument();
    expect(
      within(rows[0]).getByText("Marked paid · waiting for Sam to confirm"),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText("Jo → You")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Confirmed · done")).toBeInTheDocument();
  });

  it("offers I got it only to the recipient of a paid payment", () => {
    history([payment({})], ana);
    expect(screen.queryByRole("button", { name: /I got it/ })).toBeNull();
  });

  it("hides I got it from a read-only viewer", () => {
    history([payment({})], sam, true);
    expect(screen.queryByRole("button", { name: /I got it/ })).toBeNull();
  });

  it("confirms the payment, says so and refreshes the page", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: { payment: payment({ status: "confirmed" }), closed: false },
    });
    history([payment({})], sam);

    fireEvent.click(screen.getByRole("button", { name: /I got it/ }));

    await waitFor(() =>
      expect(
        screen.getByText("Confirmed $8.83 from Ana. Balances are updated."),
      ).toBeInTheDocument(),
    );
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/payments/9c8d7e6f-6666-4777-8888-e99900001111/confirm`,
      {},
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  // The button disappears after the refresh, and it is disabled while the
  // request is on its way, which drops focus to body in a browser. Focus goes
  // to the row instead, so a keyboard user stays where they were.
  it.each([
    [
      "it worked",
      {
        ok: true,
        data: { payment: payment({ status: "confirmed" }), closed: false },
      },
    ],
    [
      "it failed",
      {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "This payment is already confirmed.",
        },
      },
    ],
  ])("moves focus to the payment's row when %s", async (_, response) => {
    mocks.postJson.mockResolvedValue(response);
    history([payment({})], sam);
    const button = screen.getByRole("button", { name: /I got it/ });
    button.focus();

    fireEvent.click(button);

    const row = screen.getByRole("listitem");
    await waitFor(() => expect(row).toHaveFocus());
  });

  it("says when the confirmation closed a settle-up", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: { payment: payment({ status: "confirmed" }), closed: true },
    });
    history([payment({ settlementId: "s" })], sam);

    fireEvent.click(screen.getByRole("button", { name: /I got it/ }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Confirmed. That was the last one: the period is closed.",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows the server's message when confirming fails", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "This payment is already confirmed.",
      },
    });
    history([payment({})], sam);

    fireEvent.click(screen.getByRole("button", { name: /I got it/ }));

    await waitFor(() =>
      expect(
        screen.getByText("This payment is already confirmed."),
      ).toBeInTheDocument(),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  // #108: the recipient of a paid payment can say it never arrived.
  it("offers I didn't get it only to the recipient of a paid payment", () => {
    history([payment({})], ana);
    expect(
      screen.queryByRole("button", { name: /I didn't get it/ }),
    ).toBeNull();
  });

  it("hides I didn't get it from a read-only viewer", () => {
    history([payment({})], sam, true);
    expect(
      screen.queryByRole("button", { name: /I didn't get it/ }),
    ).toBeNull();
  });

  it("asks before declining a direct payment, then says it is removed", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: undefined });
    history([payment({})], sam);

    fireEvent.click(screen.getByRole("button", { name: /I didn't get it/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Didn't get $8.83 from Ana? The payment is removed, and Ana can record it again once it's sent.",
    );
    expect(mocks.postJson).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Decline payment" }));

    await waitFor(() =>
      expect(
        screen.getByText("Declined. The $8.83 from Ana is removed."),
      ).toBeInTheDocument(),
    );
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/payments/9c8d7e6f-6666-4777-8888-e99900001111/decline`,
      {},
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  // A declined direct payment's row goes away with the refresh, so focus
  // moves to the section's heading rather than dropping to body.
  it("moves focus to the Payments heading once a decline is answered", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: undefined });
    history([payment({})], sam);

    fireEvent.click(screen.getByRole("button", { name: /I didn't get it/ }));
    fireEvent.click(screen.getByRole("button", { name: "Decline payment" }));

    const heading = screen.getByRole("heading", { name: "Payments" });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("says a declined settle-up payment can be marked paid again", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: { payment: payment({ status: "suggested", paidAt: null }) },
    });
    history([payment({ settlementId: "s" })], sam);

    fireEvent.click(screen.getByRole("button", { name: /I didn't get it/ }));
    fireEvent.click(screen.getByRole("button", { name: "Decline payment" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Declined. Ana can mark it paid again once it's sent.",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows the server's message when declining fails", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "This payment is already confirmed.",
      },
    });
    history([payment({})], sam);

    fireEvent.click(screen.getByRole("button", { name: /I didn't get it/ }));
    fireEvent.click(screen.getByRole("button", { name: "Decline payment" }));

    await waitFor(() =>
      expect(
        screen.getByText("This payment is already confirmed."),
      ).toBeInTheDocument(),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
