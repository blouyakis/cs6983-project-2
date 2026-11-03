// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/http/errors";
import { checkCustomShares, hasEqualWeights, splitByWeights } from "./splits";

const payer = "payer";
const sam = "sam";
const jo = "jo";

function fieldErrorsOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return (error as ValidationError).fields;
  }
  throw new Error("expected a ValidationError");
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

describe("splitByWeights", () => {
  it("splits $10.00 evenly among 3 with the leftover cent on the payer", () => {
    expect(
      splitByWeights(1000, payer, [
        { userId: payer, weight: 1 },
        { userId: sam, weight: 1 },
        { userId: jo, weight: 1 },
      ]),
    ).toEqual([
      { userId: payer, shareCents: 334 },
      { userId: sam, shareCents: 333 },
      { userId: jo, shareCents: 333 },
    ]);
  });

  it("splits $10.01 by weights 3 and 2 with the leftover cent on the payer", () => {
    expect(
      splitByWeights(1001, payer, [
        { userId: payer, weight: 3 },
        { userId: sam, weight: 2 },
      ]),
    ).toEqual([
      { userId: payer, shareCents: 601 },
      { userId: sam, shareCents: 400 },
    ]);
  });

  it("gives the leftover to the payer even when the payer is not listed first", () => {
    expect(
      splitByWeights(1000, payer, [
        { userId: sam, weight: 1 },
        { userId: jo, weight: 1 },
        { userId: payer, weight: 1 },
      ]),
    ).toEqual([
      { userId: sam, shareCents: 333 },
      { userId: jo, shareCents: 333 },
      { userId: payer, shareCents: 334 },
    ]);
  });

  it("gives one sharer the whole amount", () => {
    expect(splitByWeights(1234, payer, [{ userId: payer, weight: 1 }])).toEqual(
      [{ userId: payer, shareCents: 1234 }],
    );
  });

  it("splits $0.00 into shares of 0", () => {
    expect(
      splitByWeights(0, payer, [
        { userId: payer, weight: 1 },
        { userId: sam, weight: 1 },
      ]),
    ).toEqual([
      { userId: payer, shareCents: 0 },
      { userId: sam, shareCents: 0 },
    ]);
  });

  it("always adds up to the amount, for many random amounts and weights", () => {
    const random = seededRandom(8);
    for (let run = 0; run < 2000; run += 1) {
      const amountCents = Math.floor(random() * 1_000_000);
      const count = 1 + Math.floor(random() * 12);
      const sharers = Array.from({ length: count }, (_, index) => ({
        userId: `member-${index}`,
        weight: 1 + Math.floor(random() * 10),
      }));
      const payerId = sharers[Math.floor(random() * count)].userId;

      const shares = splitByWeights(amountCents, payerId, sharers);

      const total = shares.reduce((sum, share) => sum + share.shareCents, 0);
      expect(total).toBe(amountCents);
      for (const share of shares) {
        expect(Number.isInteger(share.shareCents)).toBe(true);
        expect(share.shareCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("rejects sharers that leave out the payer", () => {
    expect(
      fieldErrorsOf(() =>
        splitByWeights(1000, payer, [
          { userId: sam, weight: 1 },
          { userId: jo, weight: 1 },
        ]),
      ),
    ).toEqual({
      sharedBy: "The payer must be one of the people sharing this cost.",
    });
  });

  it("rejects an empty list of sharers", () => {
    expect(fieldErrorsOf(() => splitByWeights(1000, payer, []))).toEqual({
      sharedBy: "Choose at least one person to share this cost.",
    });
  });

  it("rejects the same person twice", () => {
    expect(
      fieldErrorsOf(() =>
        splitByWeights(1000, payer, [
          { userId: payer, weight: 1 },
          { userId: payer, weight: 1 },
        ]),
      ),
    ).toEqual({ sharedBy: "Each person can share this cost only once." });
  });

  // amount_cents and share_cents are Postgres integer, so this is the most a
  // row can hold. Anything above it must be a 400, not a database error.
  it("accepts an amount of exactly 2,147,483,647 cents", () => {
    expect(
      splitByWeights(2_147_483_647, payer, [{ userId: payer, weight: 1 }]),
    ).toEqual([{ userId: payer, shareCents: 2_147_483_647 }]);
  });

  it.each([-1, 10.5, Number.NaN, 2_147_483_648, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an amount of %s",
    (amountCents) => {
      expect(
        fieldErrorsOf(() =>
          splitByWeights(amountCents, payer, [{ userId: payer, weight: 1 }]),
        ),
      ).toEqual({
        amountCents:
          "Enter an amount from $0.00 to $21,474,836.47, in whole cents.",
      });
    },
  );

  it.each([0, -1, 1.5])(
    "treats a weight of %s as a bug, not a user error",
    (weight) => {
      const run = () =>
        splitByWeights(1000, payer, [{ userId: payer, weight }]);
      expect(run).toThrow("Share weights must be positive whole numbers.");
      expect(run).not.toThrow(ValidationError);
    },
  );

  // Weights come from the database, so even a legal amount times large
  // enough weights can leave the safe integers.
  it("refuses an amount and weights too large to split exactly", () => {
    const run = () =>
      splitByWeights(2_147_483_647, payer, [
        { userId: payer, weight: 2 ** 22 },
        { userId: sam, weight: 2 ** 22 },
      ]);
    expect(run).toThrow("too large to split exactly");
    expect(run).not.toThrow(ValidationError);
  });
});

describe("hasEqualWeights", () => {
  it("is true when every sharer has the same weight", () => {
    expect(
      hasEqualWeights([
        { userId: payer, weight: 3 },
        { userId: sam, weight: 3 },
      ]),
    ).toBe(true);
  });

  it("is false when the weights differ", () => {
    expect(
      hasEqualWeights([
        { userId: payer, weight: 3 },
        { userId: sam, weight: 2 },
      ]),
    ).toBe(false);
  });

  it("is true for one sharer or none", () => {
    expect(hasEqualWeights([{ userId: payer, weight: 2 }])).toBe(true);
    expect(hasEqualWeights([])).toBe(true);
  });
});

describe("checkCustomShares", () => {
  it("accepts amounts that add up, in the order of sharedBy", () => {
    expect(
      checkCustomShares(1000, payer, [payer, sam], { sam: 400, payer: 600 }),
    ).toEqual([
      { userId: payer, shareCents: 600 },
      { userId: sam, shareCents: 400 },
    ]);
  });

  it("accepts 0 for the payer, for a cost paid only for others", () => {
    expect(
      checkCustomShares(1001, payer, [payer, sam, jo], {
        payer: 0,
        sam: 501,
        jo: 500,
      }),
    ).toEqual([
      { userId: payer, shareCents: 0 },
      { userId: sam, shareCents: 501 },
      { userId: jo, shareCents: 500 },
    ]);
  });

  it("rejects amounts that don't add up, saying both totals", () => {
    expect(
      fieldErrorsOf(() =>
        checkCustomShares(1000, payer, [payer, sam], { payer: 600, sam: 399 }),
      ),
    ).toEqual({ amountsCents: "The shares add up to $9.99, not $10.00." });
  });

  it("accepts shares of a 2,147,483,647-cent amount", () => {
    expect(
      checkCustomShares(2_147_483_647, payer, [payer, sam], {
        payer: 2_147_483_646,
        sam: 1,
      }),
    ).toEqual([
      { userId: payer, shareCents: 2_147_483_646 },
      { userId: sam, shareCents: 1 },
    ]);
  });

  it.each([
    ["a fraction of a cent", 600.5],
    ["a negative amount", -1],
    ["not a number", Number.NaN],
    ["more than a share can hold", 2_147_483_648],
  ])("rejects %s", (_, payerShare) => {
    expect(
      fieldErrorsOf(() =>
        checkCustomShares(1000, payer, [payer, sam], {
          payer: payerShare,
          sam: 400,
        }),
      ),
    ).toEqual({
      amountsCents:
        "Each share must be from $0.00 to $21,474,836.47, in whole cents.",
    });
  });

  it("rejects a sharer with no amount", () => {
    expect(
      fieldErrorsOf(() =>
        checkCustomShares(1000, payer, [payer, sam], { payer: 1000 }),
      ),
    ).toEqual({
      amountsCents: "Enter a share for everyone sharing this cost.",
    });
  });

  it("rejects an amount for someone who isn't sharing", () => {
    expect(
      fieldErrorsOf(() =>
        checkCustomShares(1000, payer, [payer, sam], {
          payer: 600,
          sam: 400,
          jo: 0,
        }),
      ),
    ).toEqual({
      amountsCents: "Only people sharing this cost can have a share.",
    });
  });

  it("rejects sharers that leave out the payer", () => {
    expect(
      fieldErrorsOf(() =>
        checkCustomShares(1000, payer, [sam, jo], { sam: 500, jo: 500 }),
      ),
    ).toEqual({
      sharedBy: "The payer must be one of the people sharing this cost.",
    });
  });

  it("rejects a bad total amount before looking at the shares", () => {
    expect(
      fieldErrorsOf(() => checkCustomShares(-5, payer, [payer], { payer: -5 })),
    ).toEqual({
      amountCents:
        "Enter an amount from $0.00 to $21,474,836.47, in whole cents.",
    });
  });
});
