import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationError } from "@/lib/http/errors";
import { parseInput } from "./parse";
import { splitSchema } from "./splits";

const payer = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "0b7e8a10-2222-4333-8444-a55566667777";

function fieldErrorsFor(
  schema: Parameters<typeof parseInput>[0],
  input: unknown,
) {
  try {
    parseInput(schema, input);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return (error as ValidationError).fields;
  }
  throw new Error("expected a ValidationError");
}

describe("splitSchema", () => {
  it("accepts an even split", () => {
    expect(
      parseInput(splitSchema, { mode: "even", sharedBy: [payer, sam] }),
    ).toEqual({ mode: "even", sharedBy: [payer, sam] });
  });

  it("accepts custom amounts", () => {
    const input = {
      mode: "custom",
      sharedBy: [payer, sam],
      amountsCents: { [payer]: 600, [sam]: 400 },
    };
    expect(parseInput(splitSchema, input)).toEqual(input);
  });

  it("drops amounts sent with an even split", () => {
    expect(
      parseInput(splitSchema, {
        mode: "even",
        sharedBy: [payer],
        amountsCents: { [payer]: 5 },
      }),
    ).toEqual({ mode: "even", sharedBy: [payer] });
  });

  it.each([undefined, "ratio"])("rejects a mode of %s", (mode) => {
    expect(fieldErrorsFor(splitSchema, { mode, sharedBy: [payer] })).toEqual({
      mode: "Choose Evenly or Custom amounts.",
    });
  });

  it("rejects an empty list of sharers", () => {
    expect(fieldErrorsFor(splitSchema, { mode: "even", sharedBy: [] })).toEqual(
      { sharedBy: "Choose at least one person to share this cost." },
    );
  });

  it.each([undefined, "sam", [42]])("rejects sharedBy of %j", (sharedBy) => {
    expect(fieldErrorsFor(splitSchema, { mode: "even", sharedBy })).toEqual({
      sharedBy: "Choose who shares this cost.",
    });
  });

  it("rejects the same person twice", () => {
    expect(
      fieldErrorsFor(splitSchema, { mode: "even", sharedBy: [payer, payer] }),
    ).toEqual({ sharedBy: "Each person can share this cost only once." });
  });

  // z.uuid accepts uppercase, but Postgres uuid ignores case, so one person
  // in two cases would get two shares and break the expense_shares key.
  it("rejects the same person twice in different case", () => {
    expect(
      fieldErrorsFor(splitSchema, {
        mode: "even",
        sharedBy: [payer, payer.toUpperCase()],
      }),
    ).toEqual({ sharedBy: "Each person can share this cost only once." });
  });

  it("returns user ids in lowercase", () => {
    expect(
      parseInput(splitSchema, {
        mode: "custom",
        sharedBy: [payer.toUpperCase(), sam],
        amountsCents: { [payer.toUpperCase()]: 600, [sam]: 400 },
      }),
    ).toEqual({
      mode: "custom",
      sharedBy: [payer, sam],
      amountsCents: { [payer]: 600, [sam]: 400 },
    });
  });

  // Lowercasing the keys alone would merge these and silently keep one.
  it("rejects two amounts for the same person in different case", () => {
    expect(
      fieldErrorsFor(splitSchema, {
        mode: "custom",
        sharedBy: [payer, sam],
        amountsCents: { [payer]: 600, [payer.toUpperCase()]: 0, [sam]: 400 },
      }),
    ).toEqual({ amountsCents: "Each person can have only one share." });
  });

  it("rejects custom amounts with no amounts", () => {
    expect(
      fieldErrorsFor(splitSchema, { mode: "custom", sharedBy: [payer] }),
    ).toEqual({
      amountsCents: "Enter a share for everyone sharing this cost.",
    });
  });

  it.each([600.5, -1, "600"])("rejects a share of %j", (share) => {
    expect(
      fieldErrorsFor(splitSchema, {
        mode: "custom",
        sharedBy: [payer],
        amountsCents: { [payer]: share },
      }),
    ).toEqual({
      amountsCents:
        "Each share must be from $0.00 to $21,474,836.47, in whole cents.",
    });
  });

  it("rejects a share for an id that isn't a user id", () => {
    expect(
      fieldErrorsFor(splitSchema, {
        mode: "custom",
        sharedBy: [payer],
        amountsCents: { sam: 0 },
      }),
    ).toEqual({ amountsCents: "Choose who shares this cost." });
  });

  it("keeps its error keys when merged into a request body", () => {
    const body = z.intersection(
      z.object({ amountCents: z.number({ error: "Enter an amount." }) }),
      splitSchema,
    );
    expect(
      fieldErrorsFor(body, { amountCents: "ten", mode: "even", sharedBy: [] }),
    ).toEqual({
      amountCents: "Enter an amount.",
      sharedBy: "Choose at least one person to share this cost.",
    });
  });
});
