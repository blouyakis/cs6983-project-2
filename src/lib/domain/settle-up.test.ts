// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Balance } from "./balances";
import { suggestPayments, type SuggestedPayment } from "./settle-up";

function balances(cents: Record<string, number>): Balance[] {
  return Object.entries(cents).map(([userId, balanceCents]) => ({
    userId,
    balanceCents,
  }));
}

// What each person ends up with after the payments: paying adds to a debtor's
// balance, receiving takes from a creditor's.
function settle(
  before: Balance[],
  payments: SuggestedPayment[],
): Record<string, number> {
  const after = Object.fromEntries(
    before.map((balance) => [balance.userId, balance.balanceCents]),
  );
  for (const payment of payments) {
    after[payment.fromUserId] += payment.amountCents;
    after[payment.toUserId] -= payment.amountCents;
  }
  return after;
}

function expectCleared(before: Balance[], payments: SuggestedPayment[]) {
  for (const payment of payments) {
    expect(payment.amountCents).toBeGreaterThan(0);
    expect(Number.isInteger(payment.amountCents)).toBe(true);
    expect(payment.fromUserId).not.toBe(payment.toUserId);
  }
  for (const cents of Object.values(settle(before, payments))) {
    expect(cents).toBe(0);
  }
}

describe("suggestPayments", () => {
  it("suggests nothing when every balance is zero", () => {
    expect(suggestPayments(balances({ a: 0, b: 0, c: 0 }))).toEqual([]);
    expect(suggestPayments([])).toEqual([]);
  });

  it("needs at most one payment between two members", () => {
    const before = balances({ a: -1234, b: 1234 });

    const payments = suggestPayments(before);

    expect(payments).toEqual([
      { fromUserId: "a", toUserId: "b", amountCents: 1234 },
    ]);
  });

  it("pays from the one who owes to the one who is owed", () => {
    expect(suggestPayments(balances({ a: 500, b: -500 }))).toEqual([
      { fromUserId: "b", toUserId: "a", amountCents: 500 },
    ]);
  });

  it("works in whole cents with no rounding drift", () => {
    const before = balances({ a: -1, b: -1, c: 2 });

    const payments = suggestPayments(before);

    expectCleared(before, payments);
    expect(payments).toHaveLength(2);
  });

  it("finds three payments for −6, −5, +2, +4, +5 where a greedy match needs four", () => {
    const before = balances({
      ana: -600,
      ben: -500,
      cy: 200,
      dee: 400,
      eve: 500,
    });

    const payments = suggestPayments(before);

    // Greedy pairs the largest debtor with the largest creditor (−6 → +5,
    // then −1 → +4, −5 → +3, −2 → +2), which is four. The subsets
    // {−5, +5} and {−6, +2, +4} clear everyone in three.
    expect(payments).toHaveLength(3);
    expectCleared(before, payments);
  });

  it("leaves members with a zero balance out of the payments", () => {
    const before = balances({ a: -300, b: 0, c: 300 });

    const payments = suggestPayments(before);

    expect(payments).toEqual([
      { fromUserId: "a", toUserId: "c", amountCents: 300 },
    ]);
  });

  it("clears several zero-sum groups with one payment fewer than their members", () => {
    // {a, b} and {c, d, e} are zero-sum on their own: 1 + 2 payments.
    const before = balances({ a: -100, b: 100, c: -250, d: -250, e: 500 });

    const payments = suggestPayments(before);

    expect(payments).toHaveLength(3);
    expectCleared(before, payments);
  });

  it("keeps the first split it found when another is just as short", () => {
    // {a, b} + {c, d} and {a, d} + {c, b} both take two payments.
    const before = balances({ a: -100, b: 100, c: -100, d: 100 });

    const payments = suggestPayments(before);

    expect(payments).toHaveLength(2);
    expectCleared(before, payments);
  });

  it("finishes quickly for twelve members with random balances", () => {
    const seeds = [1, 2, 3, 4, 5];
    for (const seed of seeds) {
      // A small deterministic generator, so a failure can be rerun.
      let state = seed * 2654435761;
      const next = () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state;
      };
      const cents: Record<string, number> = {};
      let total = 0;
      for (let index = 0; index < 11; index += 1) {
        const value = (next() % 200000) - 100000;
        cents[`m${index}`] = value;
        total += value;
      }
      cents.m11 = -total;
      const before = balances(cents);

      const startedAt = performance.now();
      const payments = suggestPayments(before);
      const elapsed = performance.now() - startedAt;

      expect(elapsed).toBeLessThan(500);
      expectCleared(before, payments);
      expect(payments.length).toBeLessThanOrEqual(11);
    }
  });

  it("refuses balances that don't add up to zero", () => {
    expect(() => suggestPayments(balances({ a: -100, b: 50 }))).toThrow(
      /add up to zero/,
    );
  });

  it("refuses balances that aren't whole cents", () => {
    expect(() => suggestPayments(balances({ a: -0.5, b: 0.5 }))).toThrow(
      /whole cents/,
    );
  });

  it("refuses more members than the group cap", () => {
    const cents: Record<string, number> = {};
    for (let index = 0; index < 13; index += 1) {
      cents[`m${index}`] = index === 12 ? -12 : 1;
    }
    expect(() => suggestPayments(balances(cents))).toThrow(/12/);
  });
});
