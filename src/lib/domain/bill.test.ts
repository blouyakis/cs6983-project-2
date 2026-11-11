import { describe, expect, it } from "vitest";
import { computeBalances } from "./balances";
import { owedToEach, sharedBy } from "./bill";

const ana = "ana";
const sam = "sam";
const jo = "jo";

function expense(
  payerId: string,
  amountCents: number,
  shares: [string, number][],
) {
  return {
    payerId,
    amountCents,
    shares: shares.map(([userId, shareCents]) => ({ userId, shareCents })),
  };
}

describe("sharedBy", () => {
  it("keeps only the expenses the user has a share in, in order", () => {
    const groceries = expense(sam, 3000, [
      [ana, 1000],
      [sam, 1000],
      [jo, 1000],
    ]);
    const samAndJo = expense(sam, 2000, [
      [sam, 1000],
      [jo, 1000],
    ]);
    const internet = expense(ana, 6000, [
      [ana, 3000],
      [jo, 3000],
    ]);

    expect(sharedBy(ana, [groceries, samAndJo, internet])).toEqual([
      groceries,
      internet,
    ]);
  });

  it("keeps a cost the user paid only for others, with a share of 0", () => {
    const forOthers = expense(ana, 1001, [
      [ana, 0],
      [sam, 501],
      [jo, 500],
    ]);

    expect(sharedBy(ana, [forOthers])).toEqual([forOthers]);
  });
});

describe("owedToEach", () => {
  it("is the user's share of what each person paid: Sam paid $30.00 for three", () => {
    const groceries = expense(sam, 3000, [
      [ana, 1000],
      [sam, 1000],
      [jo, 1000],
    ]);

    expect(owedToEach(ana, [ana, sam, jo], [groceries], [])).toEqual([
      { userId: sam, owedCents: 1000 },
      { userId: jo, owedCents: 0 },
    ]);
  });

  it("subtracts what each person owes for the user's own costs", () => {
    const groceries = expense(sam, 3000, [
      [ana, 1500],
      [sam, 1500],
    ]);
    const internet = expense(ana, 6000, [
      [ana, 3000],
      [sam, 3000],
    ]);

    expect(owedToEach(ana, [ana, sam], [groceries, internet], [])).toEqual([
      { userId: sam, owedCents: -1500 },
    ]);
  });

  it("leaves out costs between other people", () => {
    const samForJo = expense(sam, 2000, [
      [sam, 1000],
      [jo, 1000],
    ]);

    expect(owedToEach(ana, [ana, sam, jo], [samForJo], [])).toEqual([
      { userId: sam, owedCents: 0 },
      { userId: jo, owedCents: 0 },
    ]);
  });

  it("counts confirmed payments the user sent and received", () => {
    const groceries = expense(sam, 3000, [
      [ana, 1500],
      [sam, 1500],
    ]);
    const paidSam = { fromUserId: ana, toUserId: sam, amountCents: 1000 };
    const samPaidBack = { fromUserId: sam, toUserId: ana, amountCents: 200 };
    const samToJo = { fromUserId: sam, toUserId: jo, amountCents: 700 };

    expect(
      owedToEach(
        ana,
        [ana, sam, jo],
        [groceries],
        [paidSam, samPaidBack, samToJo],
      ),
    ).toEqual([
      { userId: sam, owedCents: 700 },
      { userId: jo, owedCents: 0 },
    ]);
  });

  it("adds someone who isn't a member any more after the members", () => {
    const formerPaid = expense("former", 1000, [
      [ana, 500],
      ["former", 500],
    ]);

    expect(owedToEach(ana, [ana, sam], [formerPaid], [])).toEqual([
      { userId: sam, owedCents: 0 },
      { userId: "former", owedCents: 500 },
    ]);
  });

  it("adds up to the user's balance with the sign flipped", () => {
    const expenses = [
      expense(sam, 3001, [
        [ana, 1000],
        [sam, 1001],
        [jo, 1000],
      ]),
      expense(ana, 1001, [
        [ana, 0],
        [sam, 501],
        [jo, 500],
      ]),
      expense(jo, 2500, [
        [sam, 1250],
        [jo, 1250],
      ]),
      expense(jo, 999, [
        [ana, 333],
        [jo, 666],
      ]),
    ];
    const payments = [
      { fromUserId: ana, toUserId: jo, amountCents: 100 },
      { fromUserId: sam, toUserId: ana, amountCents: 250 },
    ];
    const members = [ana, sam, jo];

    const owed = owedToEach(ana, members, expenses, payments);
    const balance = computeBalances(members, expenses, payments).find(
      (row) => row.userId === ana,
    )?.balanceCents;

    expect(owed.reduce((sum, row) => sum + row.owedCents, 0)).toBe(
      -(balance ?? 0),
    );
  });
});
