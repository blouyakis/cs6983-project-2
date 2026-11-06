import { describe, expect, it } from "vitest";
import {
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
