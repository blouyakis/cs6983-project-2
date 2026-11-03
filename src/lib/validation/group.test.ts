import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/http/errors";
import {
  createGroupSchema,
  inviteSchema,
  MAX_SHARE_WEIGHT,
  updateGroupSchema,
} from "./group";
import { parseInput } from "./parse";

const ANA = "0b0f6a3e-7c1d-4a52-9d3e-1f2a3b4c5d6e";
const BEN = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

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

describe("createGroupSchema", () => {
  it("trims the name and keeps an emoji at its start", () => {
    expect(parseInput(createGroupSchema, { name: "  🏠 Flat " })).toEqual({
      name: "🏠 Flat",
    });
  });

  it.each([undefined, "", "   "])("asks for a name when it is %j", (name) => {
    expect(fieldErrorsFor(createGroupSchema, { name })).toEqual({
      name: "Enter a group name.",
    });
  });

  it("rejects a name longer than 60 characters", () => {
    expect(fieldErrorsFor(createGroupSchema, { name: "a".repeat(61) })).toEqual(
      { name: "Group name must be at most 60 characters." },
    );
  });
});

describe("inviteSchema", () => {
  it("trims the email and makes it lowercase", () => {
    expect(parseInput(inviteSchema, { email: " Sam@Example.COM " })).toEqual({
      email: "sam@example.com",
    });
  });

  it("rejects something that is not an email", () => {
    expect(fieldErrorsFor(inviteSchema, { email: "sam" })).toEqual({
      email: "Enter a valid email address.",
    });
  });
});

describe("updateGroupSchema", () => {
  it("accepts a new name on its own", () => {
    expect(parseInput(updateGroupSchema, { name: " Dorm 4B " })).toEqual({
      name: "Dorm 4B",
    });
  });

  it("accepts weights on their own, with user ids in any case", () => {
    expect(
      parseInput(updateGroupSchema, {
        memberWeights: [
          { userId: ANA.toUpperCase(), weight: 3 },
          { userId: BEN, weight: 2 },
        ],
      }),
    ).toEqual({
      memberWeights: [
        { userId: ANA, weight: 3 },
        { userId: BEN, weight: 2 },
      ],
    });
  });

  it("allows weights up to 100", () => {
    expect(MAX_SHARE_WEIGHT).toBe(100);
    expect(
      parseInput(updateGroupSchema, {
        memberWeights: [{ userId: ANA, weight: 100 }],
      }),
    ).toEqual({ memberWeights: [{ userId: ANA, weight: 100 }] });
  });

  it.each([0, -1, 1.5, 101, "2"])("rejects a weight of %j", (weight) => {
    expect(
      fieldErrorsFor(updateGroupSchema, {
        memberWeights: [{ userId: ANA, weight }],
      }),
    ).toEqual({
      memberWeights: "Each weight must be a whole number from 1 to 100.",
    });
  });

  it("rejects a user id that is not a UUID", () => {
    expect(
      fieldErrorsFor(updateGroupSchema, {
        memberWeights: [{ userId: "sam", weight: 1 }],
      }),
    ).toEqual({ memberWeights: "Each member must be a user id." });
  });

  it("rejects the same member listed twice, in any case", () => {
    expect(
      fieldErrorsFor(updateGroupSchema, {
        memberWeights: [
          { userId: ANA, weight: 1 },
          { userId: ANA.toUpperCase(), weight: 2 },
        ],
      }),
    ).toEqual({ memberWeights: "List each member once." });
  });

  it("rejects an empty list of weights", () => {
    expect(fieldErrorsFor(updateGroupSchema, { memberWeights: [] })).toEqual({
      memberWeights: "List a weight for every current member.",
    });
  });

  it("rejects a body with nothing to change", () => {
    expect(() => parseInput(updateGroupSchema, {})).toThrow(ValidationError);
  });

  it("checks a new name the same way as a new group", () => {
    expect(fieldErrorsFor(updateGroupSchema, { name: " " })).toEqual({
      name: "Enter a group name.",
    });
  });
});
