import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CENTS, splitMessages } from "@/lib/domain/splits";
import { ValidationError } from "@/lib/http/errors";
import {
  createExpenseSchema,
  expenseParamsSchema,
  updateExpenseSchema,
} from "./expense";
import { parseInput } from "./parse";

const ANA = "0b0f6a3e-7c1d-4a52-9d3e-1f2a3b4c5d6e";
const BEN = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const valid = {
  description: "Electricity",
  amountCents: 1234,
  spentOn: "2026-11-02",
  mode: "even",
  sharedBy: [ANA, BEN],
};

function fieldErrorsFor(input: unknown) {
  try {
    parseInput(createExpenseSchema, input);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return (error as ValidationError).fields;
  }
  throw new Error("expected a ValidationError");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createExpenseSchema", () => {
  it("keeps the expense fields and the split fields at the top level", () => {
    expect(parseInput(createExpenseSchema, valid)).toEqual(valid);
  });

  it("accepts a custom split with its amounts", () => {
    const custom = {
      ...valid,
      mode: "custom",
      amountsCents: { [ANA]: 1000, [BEN]: 234 },
    };
    expect(parseInput(createExpenseSchema, custom)).toEqual(custom);
  });

  it("trims the description", () => {
    expect(
      parseInput(createExpenseSchema, { ...valid, description: "  Dinner " })
        .description,
    ).toBe("Dinner");
  });

  it("ignores a payer id in the body, because the payer is the current user", () => {
    const parsed = parseInput(createExpenseSchema, {
      ...valid,
      payerId: BEN,
    });
    expect(parsed).not.toHaveProperty("payerId");
  });

  it.each([undefined, "", "   ", 5])(
    "asks for a description when it is %j",
    (description) => {
      expect(fieldErrorsFor({ ...valid, description })).toEqual({
        description: "Enter what this cost was for.",
      });
    },
  );

  it("rejects a description longer than 100 characters", () => {
    expect(fieldErrorsFor({ ...valid, description: "x".repeat(101) })).toEqual({
      description: "The description must be at most 100 characters.",
    });
  });

  it.each([
    ["negative", -1],
    ["a fraction of a cent", 12.5],
    ["more than 2,147,483,647 cents", MAX_CENTS + 1],
    ["text", "12.34"],
    ["missing", undefined],
  ])("rejects an amount that is %s with the message splits.ts uses", (_, v) => {
    expect(fieldErrorsFor({ ...valid, amountCents: v })).toEqual({
      amountCents: splitMessages.amount,
    });
  });

  it.each([0, 1, MAX_CENTS])("accepts an amount of %i cents", (amountCents) => {
    expect(
      parseInput(createExpenseSchema, { ...valid, amountCents }).amountCents,
    ).toBe(amountCents);
  });

  it.each([undefined, "", "11/02/2026", "2026-2-3", "2026-02-30", 20261102])(
    "asks for a day when it is %j",
    (spentOn) => {
      expect(fieldErrorsFor({ ...valid, spentOn })).toEqual({
        spentOn: "Enter the day this was spent, such as 2026-11-02.",
      });
    },
  );

  it("accepts today", () => {
    expect(
      parseInput(createExpenseSchema, { ...valid, spentOn: "2026-11-04" })
        .spentOn,
    ).toBe("2026-11-04");
  });

  it("rejects a day in the future", () => {
    expect(fieldErrorsFor({ ...valid, spentOn: "2026-11-20" })).toEqual({
      spentOn: "The day can't be in the future.",
    });
  });

  it("accepts tomorrow, since a user east of UTC is already on it", () => {
    expect(
      parseInput(createExpenseSchema, { ...valid, spentOn: "2026-11-05" })
        .spentOn,
    ).toBe("2026-11-05");
  });

  it("rejects the day after tomorrow", () => {
    expect(fieldErrorsFor({ ...valid, spentOn: "2026-11-06" })).toEqual({
      spentOn: "The day can't be in the future.",
    });
  });

  it("reports split errors under the split field, not under a nested key", () => {
    expect(fieldErrorsFor({ ...valid, sharedBy: [] })).toEqual({
      sharedBy: splitMessages.noSharers,
    });
    expect(fieldErrorsFor({ ...valid, mode: "weights" })).toEqual({
      mode: "Choose Evenly or Custom amounts.",
    });
  });

  it("reports every broken field at once", () => {
    expect(
      Object.keys(
        fieldErrorsFor({ ...valid, description: "", amountCents: -1 }) ?? {},
      ).sort(),
    ).toEqual(["amountCents", "description"]);
  });

  it("lowercases the ids of the people sharing", () => {
    expect(
      parseInput(createExpenseSchema, {
        ...valid,
        sharedBy: [ANA.toUpperCase(), BEN],
      }).sharedBy,
    ).toEqual([ANA, BEN]);
  });
});

describe("updateExpenseSchema", () => {
  it("takes the same fields as creating, because an edit replaces them all", () => {
    expect(parseInput(updateExpenseSchema, valid)).toEqual(valid);
  });

  it("ignores a payer id in the body, because the payer can't be changed", () => {
    const parsed = parseInput(updateExpenseSchema, {
      ...valid,
      payerId: BEN,
    });

    expect(parsed).not.toHaveProperty("payerId");
  });

  it("rejects a missing split, so an edit can't leave stale shares", () => {
    expect(() =>
      parseInput(updateExpenseSchema, {
        description: "Dinner",
        amountCents: 1000,
        spentOn: "2026-11-02",
      }),
    ).toThrow(ValidationError);
  });
});

describe("expenseParamsSchema", () => {
  it("accepts a group id and an expense id that are UUIDs", () => {
    expect(
      parseInput(expenseParamsSchema, { groupId: ANA, expenseId: BEN }),
    ).toEqual({ groupId: ANA, expenseId: BEN });
  });

  it.each([
    ["groupId", { groupId: "flat", expenseId: BEN }],
    ["expenseId", { groupId: ANA, expenseId: "1" }],
  ])("rejects a malformed %s", (field, params) => {
    try {
      parseInput(expenseParamsSchema, params);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields).toHaveProperty(field);
      return;
    }
    throw new Error("expected a ValidationError");
  });
});
