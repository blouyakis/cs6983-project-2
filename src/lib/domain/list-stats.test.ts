import { describe, expect, it } from "vitest";
import {
  checkedOffTotals,
  monthOf,
  openEstimateTotalCents,
  spentInMonthCents,
} from "./list-stats";

describe("openEstimateTotalCents", () => {
  it("is 0 for an empty list", () => {
    expect(openEstimateTotalCents([])).toBe(0);
  });

  it("adds up the estimates of open items and skips done ones", () => {
    expect(
      openEstimateTotalCents([
        { status: "open", estimatedCents: 1200 },
        { status: "open", estimatedCents: 350 },
        { status: "done", estimatedCents: 900 },
      ]),
    ).toBe(1550);
  });

  it("leaves the total unchanged for an item with no estimate", () => {
    expect(
      openEstimateTotalCents([
        { status: "open", estimatedCents: 1200 },
        { status: "open", estimatedCents: null },
      ]),
    ).toBe(1200);
  });
});

describe("spentInMonthCents", () => {
  it("is 0 with no expenses", () => {
    expect(spentInMonthCents([], "2026-11")).toBe(0);
  });

  it("adds up only the expenses dated in the month", () => {
    expect(
      spentInMonthCents(
        [
          { spentOn: "2026-11-02", amountCents: 400 },
          { spentOn: "2026-10-28", amountCents: 900 },
        ],
        "2026-11",
      ),
    ).toBe(400);
  });

  it("counts the first and last day of the month, and not the days around it", () => {
    expect(
      spentInMonthCents(
        [
          { spentOn: "2026-10-31", amountCents: 1 },
          { spentOn: "2026-11-01", amountCents: 20 },
          { spentOn: "2026-11-30", amountCents: 300 },
          { spentOn: "2026-12-01", amountCents: 4000 },
        ],
        "2026-11",
      ),
    ).toBe(320);
  });

  it("doesn't count the same month in another year", () => {
    expect(
      spentInMonthCents(
        [{ spentOn: "2025-11-15", amountCents: 500 }],
        "2026-11",
      ),
    ).toBe(0);
  });
});

describe("monthOf", () => {
  it("gives the UTC year and month, with the month in two digits", () => {
    expect(monthOf(new Date("2026-01-09T12:00:00Z"))).toBe("2026-01");
  });

  it("goes by UTC, not the server's local time", () => {
    expect(monthOf(new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
    expect(monthOf(new Date("2026-12-01T00:30:00Z"))).toBe("2026-12");
  });
});

describe("checkedOffTotals", () => {
  const done = (estimatedCents: number | null, costCents: number | null) => ({
    status: "done" as const,
    estimatedCents,
    costCents,
  });

  it("adds up what the done items cost, leaving open items out (#12)", () => {
    expect(
      checkedOffTotals([
        done(500, 450),
        done(null, 1000),
        { status: "open", estimatedCents: 900, costCents: null },
      ]).spentCents,
    ).toBe(1450);
  });

  it("counts an item checked off with no cost as $0.00", () => {
    expect(checkedOffTotals([done(500, null)]).spentCents).toBe(0);
  });

  it("compares cost with the estimate only for done items that had one", () => {
    // 450 against 500 and 0 against 300; the unestimated 1000 is left out.
    expect(
      checkedOffTotals([done(500, 450), done(300, null), done(null, 1000)])
        .overEstimateCents,
    ).toBe(-350);
  });

  it("is over the estimate when the costs came to more", () => {
    expect(checkedOffTotals([done(500, 620)]).overEstimateCents).toBe(120);
  });

  it("has nothing to compare when no done item had an estimate", () => {
    expect(checkedOffTotals([done(null, 1000)]).overEstimateCents).toBeNull();
    expect(checkedOffTotals([]).overEstimateCents).toBeNull();
  });
});
