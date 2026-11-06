// @vitest-environment node
import { describe, expect, it } from "vitest";
import { shareOfExpensesCents, summarizeBalances } from "./overview";

describe("summarizeBalances", () => {
  it("nets −883 in one group and +500 in another to −383, owing $8.83 and owed $5.00", () => {
    expect(summarizeBalances([-883, 500])).toEqual({
      netCents: -383,
      owingCents: 883,
      owedCents: 500,
    });
  });

  it("is all zero for a user with no shared groups", () => {
    expect(summarizeBalances([])).toEqual({
      netCents: 0,
      owingCents: 0,
      owedCents: 0,
    });
  });

  it("is all zero when every group is settled", () => {
    expect(summarizeBalances([0, 0])).toEqual({
      netCents: 0,
      owingCents: 0,
      owedCents: 0,
    });
  });

  it("adds up owing and owed across several groups, and the net is their difference", () => {
    const summary = summarizeBalances([-3100, 1850, -1100]);
    expect(summary).toEqual({
      netCents: -2350,
      owingCents: 4200,
      owedCents: 1850,
    });
    expect(summary.owedCents - summary.owingCents).toBe(summary.netCents);
  });
});

describe("shareOfExpensesCents", () => {
  const expenses = [
    {
      shares: [
        { userId: "ana", shareCents: 617 },
        { userId: "sam", shareCents: 617 },
      ],
    },
    {
      shares: [
        { userId: "ana", shareCents: 0 },
        { userId: "sam", shareCents: 501 },
        { userId: "jo", shareCents: 500 },
      ],
    },
    { shares: [{ userId: "sam", shareCents: 1000 }] },
  ];

  it("adds up only the user's own shares", () => {
    expect(shareOfExpensesCents("ana", expenses)).toBe(617);
    expect(shareOfExpensesCents("sam", expenses)).toBe(2118);
  });

  it("is 0 for a user who shares none of them", () => {
    expect(shareOfExpensesCents("lee", expenses)).toBe(0);
  });

  it("is 0 with no expenses", () => {
    expect(shareOfExpensesCents("ana", [])).toBe(0);
  });
});
