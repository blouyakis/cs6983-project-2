import { describe, expect, it } from "vitest";
import type { Member } from "@/lib/db/group-members";
import {
  initialDefaultSplit,
  resolveDefaultSplit,
  type DefaultSplitState,
} from "./default-split";

const ana: Member = { userId: "ana-id", name: "Ana", defaultShareWeight: 1 };
const ben: Member = { userId: "ben-id", name: "Ben", defaultShareWeight: 1 };
const cal: Member = { userId: "cal-id", name: "Cal", defaultShareWeight: 1 };

function weighted(member: Member, weight: number): Member {
  return { ...member, defaultShareWeight: weight };
}

function custom(percents: Record<string, string>): DefaultSplitState {
  return { mode: "custom", percents };
}

describe("initialDefaultSplit", () => {
  it("opens on Evenly when every weight is equal", () => {
    expect(initialDefaultSplit([ana, ben]).mode).toBe("even");
    expect(
      initialDefaultSplit([weighted(ana, 50), weighted(ben, 50)]).mode,
    ).toBe("even");
  });

  it("opens on Custom percentages filled in from weights 3 and 2 as 60 and 40", () => {
    expect(initialDefaultSplit([weighted(ana, 3), weighted(ben, 2)])).toEqual(
      custom({ "ana-id": "60", "ben-id": "40" }),
    );
  });

  it("rounds the percents so they add up to 100", () => {
    expect(
      initialDefaultSplit([
        weighted(ana, 1),
        weighted(ben, 1),
        weighted(cal, 2),
      ]).percents,
    ).toEqual({ "ana-id": "25", "ben-id": "25", "cal-id": "50" });
    expect(
      initialDefaultSplit([weighted(ana, 1), weighted(ben, 2)]).percents,
    ).toEqual({ "ana-id": "33", "ben-id": "67" });
  });

  it("fills in the percents of an even split too, for switching to Custom", () => {
    expect(initialDefaultSplit([ana, ben, cal]).percents).toEqual({
      "ana-id": "34",
      "ben-id": "33",
      "cal-id": "33",
    });
  });
});

describe("resolveDefaultSplit", () => {
  it("sends weight 1 for every current member on Evenly", () => {
    expect(
      resolveDefaultSplit(
        { mode: "even", percents: { "ana-id": "60", "ben-id": "40" } },
        [weighted(ana, 60), weighted(ben, 40)],
      ),
    ).toEqual({
      memberWeights: [
        { userId: "ana-id", weight: 1 },
        { userId: "ben-id", weight: 1 },
      ],
    });
  });

  it("stores 60 and 40 as weights 60 and 40", () => {
    expect(
      resolveDefaultSplit(custom({ "ana-id": "60", "ben-id": " 40 " }), [
        ana,
        ben,
      ]),
    ).toEqual({
      memberWeights: [
        { userId: "ana-id", weight: 60 },
        { userId: "ben-id", weight: 40 },
      ],
    });
  });

  it("blocks percents that don't add up to 100, saying what they add up to", () => {
    expect(
      resolveDefaultSplit(custom({ "ana-id": "60", "ben-id": "30" }), [
        ana,
        ben,
      ]),
    ).toEqual({
      errors: {
        total: "The percentages add up to 90%. Make them add up to 100%.",
      },
    });
  });

  it.each(["0", "", "abc", "12.5", "-5", "101"])(
    "blocks %j next to that member's field",
    (typed) => {
      expect(
        resolveDefaultSplit(custom({ "ana-id": typed, "ben-id": "50" }), [
          ana,
          ben,
        ]),
      ).toEqual({
        errors: { "ana-id": "Enter a whole percent from 1 to 100." },
      });
    },
  );

  it("treats a member with no field as empty", () => {
    expect(
      resolveDefaultSplit(custom({ "ana-id": "100" }), [ana, ben]),
    ).toEqual({ errors: { "ben-id": "Enter a whole percent from 1 to 100." } });
  });
});
