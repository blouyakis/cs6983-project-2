import { describe, expect, it } from "vitest";
import { MAX_CENTS } from "@/lib/domain/splits";
import { ValidationError } from "@/lib/http/errors";
import {
  createListItemSchema,
  listItemParamsSchema,
  updateListItemSchema,
} from "./list-item";
import { parseInput } from "./parse";

const GROUP = "0b0f6a3e-7c1d-4a52-9d3e-1f2a3b4c5d6e";
const ITEM = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function fieldErrorsFor(
  schema: typeof createListItemSchema | typeof updateListItemSchema,
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

describe("createListItemSchema", () => {
  it("accepts a title on its own, with no quantity, note or estimate", () => {
    expect(parseInput(createListItemSchema, { title: "Milk" })).toEqual({
      title: "Milk",
      quantity: null,
      note: null,
      estimatedCents: null,
    });
  });

  it("keeps a quantity, a note and an estimate", () => {
    expect(
      parseInput(createListItemSchema, {
        title: "🥛 Milk",
        quantity: 2,
        note: "Oat, not dairy",
        estimatedCents: 450,
      }),
    ).toEqual({
      title: "🥛 Milk",
      quantity: 2,
      note: "Oat, not dairy",
      estimatedCents: 450,
    });
  });

  it("trims the title and the note, and treats a blank note as none", () => {
    expect(
      parseInput(createListItemSchema, { title: "  Bread ", note: "   " }),
    ).toMatchObject({ title: "Bread", note: null });
  });

  it("ignores who added it, because that is the current user", () => {
    const parsed = parseInput(createListItemSchema, {
      title: "Milk",
      addedBy: ITEM,
    });
    expect(parsed).not.toHaveProperty("addedBy");
  });

  it.each([undefined, "", "   ", 5])(
    "asks for a title when it is %j",
    (title) => {
      expect(fieldErrorsFor(createListItemSchema, { title })).toEqual({
        title: "Enter what to do or buy.",
      });
    },
  );

  it("rejects a title longer than 100 characters", () => {
    expect(
      fieldErrorsFor(createListItemSchema, { title: "x".repeat(101) }),
    ).toEqual({ title: "The title must be at most 100 characters." });
  });

  it("rejects a note longer than 200 characters", () => {
    expect(
      fieldErrorsFor(createListItemSchema, {
        title: "Milk",
        note: "x".repeat(201),
      }),
    ).toEqual({ note: "The note must be at most 200 characters." });
  });

  it.each([0, -1, 1.5, "2", MAX_CENTS + 1])(
    "rejects a quantity of %j",
    (quantity) => {
      expect(
        fieldErrorsFor(createListItemSchema, { title: "Milk", quantity }),
      ).toEqual({ quantity: "Enter a quantity of 1 or more, in whole units." });
    },
  );

  it.each([0, -100, 12.5, "450", MAX_CENTS + 1])(
    "rejects an estimate of %j cents",
    (estimatedCents) => {
      expect(
        fieldErrorsFor(createListItemSchema, { title: "Milk", estimatedCents }),
      ).toEqual({
        estimatedCents:
          "Enter an estimate from $0.01 to $21,474,836.47, in whole cents.",
      });
    },
  );

  it("accepts the largest estimate the database can hold", () => {
    expect(
      parseInput(createListItemSchema, {
        title: "Car",
        estimatedCents: MAX_CENTS,
      }).estimatedCents,
    ).toBe(MAX_CENTS);
  });
});

describe("updateListItemSchema", () => {
  it("keeps only the fields that were sent", () => {
    expect(parseInput(updateListItemSchema, { estimatedCents: 1200 })).toEqual({
      estimatedCents: 1200,
    });
  });

  it("clears a quantity, a note or an estimate sent as null", () => {
    expect(
      parseInput(updateListItemSchema, {
        quantity: null,
        note: null,
        estimatedCents: null,
      }),
    ).toEqual({ quantity: null, note: null, estimatedCents: null });
  });

  it("does not let the title be cleared", () => {
    expect(fieldErrorsFor(updateListItemSchema, { title: null })).toEqual({
      title: "Enter what to do or buy.",
    });
  });

  it("applies the same rules as adding an item", () => {
    expect(
      fieldErrorsFor(updateListItemSchema, { quantity: 0, estimatedCents: 0 }),
    ).toEqual({
      quantity: "Enter a quantity of 1 or more, in whole units.",
      estimatedCents:
        "Enter an estimate from $0.01 to $21,474,836.47, in whole cents.",
    });
  });

  it("rejects a body that changes nothing", () => {
    expect(() => parseInput(updateListItemSchema, {})).toThrow(ValidationError);
  });

  it("drops a status, so a body with only a status changes nothing (checking off is #12)", () => {
    expect(() => parseInput(updateListItemSchema, { status: "done" })).toThrow(
      ValidationError,
    );
  });
});

describe("listItemParamsSchema", () => {
  it("accepts a group id and an item id", () => {
    expect(
      parseInput(listItemParamsSchema, { groupId: GROUP, itemId: ITEM }),
    ).toEqual({ groupId: GROUP, itemId: ITEM });
  });

  it("rejects an item id that is not a UUID", () => {
    expect(() =>
      parseInput(listItemParamsSchema, { groupId: GROUP, itemId: "1" }),
    ).toThrow(ValidationError);
  });
});
