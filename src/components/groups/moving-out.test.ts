import { describe, expect, it } from "vitest";
import type { Payment } from "@/lib/db/settlements";
import { hasWaitingPayment } from "./moving-out";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "9c8d7e6f-6666-4777-8888-e99900001111",
    groupId: "0b7e8a10-2222-4333-8444-a55566667777",
    fromUserId: ana,
    toUserId: sam,
    amountCents: 500,
    status: "paid",
    settlementId: null,
    createdAt: "2026-11-02T10:00:00+00:00",
    paidAt: "2026-11-02T10:00:00+00:00",
    confirmedAt: null,
    ...overrides,
  };
}

// Mirrors leave_group's pending_payment check (#22), so the Leave button is
// only offered when the server would let the user leave.
describe("hasWaitingPayment", () => {
  it("is false with no payments", () => {
    expect(hasWaitingPayment(ana, [])).toBe(false);
  });

  it.each([
    ["paid by them", { fromUserId: ana, toUserId: sam }],
    ["paid to them", { fromUserId: sam, toUserId: ana }],
  ])("is true for a payment %s that isn't confirmed yet", (_case, people) => {
    expect(hasWaitingPayment(ana, [payment(people)])).toBe(true);
  });

  it("is true for a suggested payment of an open settle-up", () => {
    expect(
      hasWaitingPayment(ana, [
        payment({
          status: "suggested",
          paidAt: null,
          toUserId: ana,
          fromUserId: jo,
        }),
      ]),
    ).toBe(true);
  });

  it("is false once the payment is confirmed", () => {
    expect(
      hasWaitingPayment(ana, [
        payment({
          status: "confirmed",
          confirmedAt: "2026-11-03T10:00:00+00:00",
        }),
      ]),
    ).toBe(false);
  });

  it("is false for a payment between other members", () => {
    expect(
      hasWaitingPayment(ana, [payment({ fromUserId: sam, toUserId: jo })]),
    ).toBe(false);
  });
});
