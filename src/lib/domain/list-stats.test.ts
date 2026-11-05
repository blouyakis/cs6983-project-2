import { describe, expect, it } from "vitest";
import { openEstimateTotalCents } from "./list-stats";

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
