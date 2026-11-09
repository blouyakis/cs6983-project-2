import { describe, expect, it } from "vitest";
import type { Payment } from "@/lib/db/settlements";
import { describeDecline, describePayment } from "./payment-status";

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const joId = "1a2b3c4d-3333-4444-8555-b66677778888";
const names = { [anaId]: "Ana", [samId]: "Sam", [joId]: "Jo" };

const suggested: Payment = {
  id: "9c8d7e6f-6666-4777-8888-e99900001111",
  groupId: "g",
  fromUserId: anaId,
  toUserId: samId,
  amountCents: 3100,
  status: "suggested",
  settlementId: "s",
  createdAt: "2026-11-01T10:00:00+00:00",
  paidAt: null,
  confirmedAt: null,
};
const paid: Payment = {
  ...suggested,
  status: "paid",
  paidAt: "2026-11-02T10:00:00+00:00",
};
const confirmed: Payment = {
  ...paid,
  status: "confirmed",
  confirmedAt: "2026-11-03T10:00:00+00:00",
};

describe("describePayment", () => {
  it("names the viewer as You on either side", () => {
    expect(describePayment(suggested, anaId, names)).toMatchObject({
      from: "You",
      to: "Sam",
    });
    expect(describePayment(suggested, samId, names)).toMatchObject({
      from: "Ana",
      to: "You",
    });
  });

  it("calls someone the viewer can't see a former member", () => {
    expect(describePayment(suggested, joId, {})).toMatchObject({
      from: "a former member",
      to: "a former member",
    });
  });

  it.each([
    [
      "the sender of a suggested payment",
      suggested,
      anaId,
      "Suggested · pay however you like",
      "paid",
    ],
    [
      "anyone else on a suggested payment",
      suggested,
      samId,
      "Suggested · waiting for Ana to pay",
      null,
    ],
    [
      "the recipient of a paid payment",
      paid,
      samId,
      "Marked paid · waiting for you to confirm",
      "confirmed",
    ],
    [
      "anyone else on a paid payment",
      paid,
      joId,
      "Marked paid · waiting for Sam to confirm",
      null,
    ],
    [
      "anyone on a confirmed payment",
      confirmed,
      samId,
      "Confirmed · done",
      null,
    ],
  ] as const)(
    "tells %s its status in words and what they can do",
    (_case, payment, viewerId, status, action) => {
      expect(describePayment(payment, viewerId, names)).toMatchObject({
        status,
        action,
      });
    },
  );
});

// #108: what the recipient is asked before declining, and told after.
describe("describeDecline", () => {
  const paid: Payment = {
    ...suggested,
    status: "paid",
    paidAt: "2026-11-02T10:00:00+00:00",
  };

  it("says a settle-up payment goes back to suggested", () => {
    expect(describeDecline(paid, "Ana")).toEqual({
      question:
        "Didn't get $31.00 from Ana? It goes back to suggested, so Ana can mark it paid again once it's sent.",
      done: "Declined. Ana can mark it paid again once it's sent.",
    });
  });

  it("says a direct payment is removed", () => {
    expect(describeDecline({ ...paid, settlementId: null }, "Ana")).toEqual({
      question:
        "Didn't get $31.00 from Ana? The payment is removed, and Ana can record it again once it's sent.",
      done: "Declined. The $31.00 from Ana is removed.",
    });
  });
});
