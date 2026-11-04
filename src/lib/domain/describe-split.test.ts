import { describe, expect, it } from "vitest";
import { describeSplit } from "./describe-split";

describe("describeSplit", () => {
  it.each([[[]], [[1]], [[1, 1, 1]], [[2, 2]]])(
    "calls %j an even split",
    (weights) => {
      expect(describeSplit(weights)).toBe("even split");
    },
  );

  it("writes 3 and 2 as 60/40, in the members' order", () => {
    expect(describeSplit([3, 2])).toBe("60/40 default");
    expect(describeSplit([2, 3])).toBe("40/60 default");
  });

  it("rounds to whole percents that still add up to 100", () => {
    // 1:2 is 33.3/66.7, and 1:1:1:2:2 rounds each part down.
    expect(describeSplit([1, 2])).toBe("33/67 default");
    expect(describeSplit([1, 1, 1, 2, 2])).toBe("14/14/14/29/29 default");
    for (const weights of [
      [1, 2],
      [1, 1, 1, 2, 2],
      [1, 2, 4],
      [7, 7, 7, 1],
    ]) {
      const parts = describeSplit(weights)
        .replace(" default", "")
        .split("/")
        .map(Number);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(100);
    }
  });

  it("never shows 0% for a member with a weight", () => {
    // 100:1 among 12 rounds one of the 1s down to 0 by largest remainder
    // alone, which would say that member pays nothing.
    const weights = [100, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

    const parts = describeSplit(weights)
      .replace(" default", "")
      .split("/")
      .map(Number);

    expect(parts).not.toContain(0);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(100);
    expect(describeSplit(weights)).toBe("89/1/1/1/1/1/1/1/1/1/1/1 default");
  });
});
