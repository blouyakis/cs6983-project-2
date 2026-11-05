// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  computeBalances,
  type BalanceExpense,
  type ConfirmedPayment,
} from "./balances";

const a = "a";
const b = "b";
const c = "c";

function even(
  payerId: string,
  amountCents: number,
  sharers: string[],
): BalanceExpense {
  const each = Math.floor(amountCents / sharers.length);
  const leftover = amountCents - each * sharers.length;
  return {
    payerId,
    amountCents,
    shares: sharers.map((userId) => ({
      userId,
      shareCents: each + (userId === payerId ? leftover : 0),
    })),
  };
}

function balanceOf(
  balances: { userId: string; balanceCents: number }[],
  userId: string,
): number {
  const found = balances.find((balance) => balance.userId === userId);
  if (!found) {
    throw new Error(`no balance for ${userId}`);
  }
  return found.balanceCents;
}

// A seeded generator, so a failing random case can be reproduced.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("computeBalances", () => {
  it("is what each member paid minus their shares: $12.34 by A and $30.00 by B, evenly", () => {
    const balances = computeBalances(
      [a, b],
      [even(a, 1234, [a, b]), even(b, 3000, [a, b])],
      [],
    );

    expect(balanceOf(balances, a)).toBe(-883);
    expect(balanceOf(balances, b)).toBe(883);
  });

  it("is zero for both after A pays B the 883 and B confirms it", () => {
    const balances = computeBalances(
      [a, b],
      [even(a, 1234, [a, b]), even(b, 3000, [a, b])],
      [{ fromUserId: a, toUserId: b, amountCents: 883 }],
    );

    expect(balanceOf(balances, a)).toBe(0);
    expect(balanceOf(balances, b)).toBe(0);
  });

  it("gives every member a balance, zero for one with no expenses or payments", () => {
    const balances = computeBalances([a, b, c], [even(a, 1000, [a, b])], []);

    expect(balances).toEqual([
      { userId: a, balanceCents: 500 },
      { userId: b, balanceCents: -500 },
      { userId: c, balanceCents: 0 },
    ]);
  });

  it("keeps the members' order", () => {
    const balances = computeBalances([c, a, b], [], []);

    expect(balances.map((balance) => balance.userId)).toEqual([c, a, b]);
  });

  it("includes someone in an expense or payment who is no longer a member, so the group still sums to zero", () => {
    const balances = computeBalances(
      [a, b],
      [even(c, 300, [a, b, c])],
      [{ fromUserId: a, toUserId: c, amountCents: 100 }],
    );

    expect(balances).toEqual([
      { userId: a, balanceCents: 0 },
      { userId: b, balanceCents: -100 },
      { userId: c, balanceCents: 100 },
    ]);
  });

  it("counts a cost paid only for others as owed to the payer in full", () => {
    const balances = computeBalances(
      [a, b, c],
      [
        {
          payerId: a,
          amountCents: 1001,
          shares: [
            { userId: a, shareCents: 0 },
            { userId: b, shareCents: 501 },
            { userId: c, shareCents: 500 },
          ],
        },
      ],
      [],
    );

    expect(balances).toEqual([
      { userId: a, balanceCents: 1001 },
      { userId: b, balanceCents: -501 },
      { userId: c, balanceCents: -500 },
    ]);
  });

  it("matches the seed group: Demo +198, Jo -802, Sam +604", () => {
    const demo = "demo";
    const sam = "sam";
    const jo = "jo";
    const balances = computeBalances(
      [demo, sam, jo],
      [
        even(demo, 6000, [demo, sam, jo]),
        even(sam, 4510, [demo, sam, jo]),
        even(jo, 3000, [demo, sam, jo]),
        even(sam, 899, [demo, sam, jo]),
      ],
      [{ fromUserId: jo, toUserId: demo, amountCents: 1000 }],
    );

    expect(balances).toEqual([
      { userId: demo, balanceCents: 198 },
      { userId: sam, balanceCents: 604 },
      { userId: jo, balanceCents: -802 },
    ]);
  });

  it("always adds up to zero, for many random expenses and payments", () => {
    const random = seededRandom(9);
    const members = [a, b, c, "d", "e"];
    for (let round = 0; round < 200; round += 1) {
      const expenses: BalanceExpense[] = [];
      const payments: ConfirmedPayment[] = [];
      const count = 1 + Math.floor(random() * 8);
      for (let i = 0; i < count; i += 1) {
        const payer = members[Math.floor(random() * members.length)];
        const others = members.filter(
          (member) => member !== payer && random() < 0.6,
        );
        expenses.push(
          even(payer, Math.floor(random() * 100_000), [payer, ...others]),
        );
      }
      const paymentCount = Math.floor(random() * 4);
      for (let i = 0; i < paymentCount; i += 1) {
        const from = members[Math.floor(random() * members.length)];
        const to = members.filter((member) => member !== from)[
          Math.floor(random() * (members.length - 1))
        ];
        payments.push({
          fromUserId: from,
          toUserId: to,
          amountCents: 1 + Math.floor(random() * 10_000),
        });
      }

      const balances = computeBalances(members, expenses, payments);

      const total = balances.reduce(
        (sum, balance) => sum + balance.balanceCents,
        0,
      );
      expect(total).toBe(0);
      expect(balances).toHaveLength(members.length);
    }
  });
});
