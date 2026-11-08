import { describe, expect, it } from "vitest";
import { formatCents } from "@/lib/domain/money";
import { MAX_CENTS } from "@/lib/domain/splits";
import { ValidationError } from "@/lib/http/errors";
import { createPaymentSchema, paymentParamsSchema } from "./payment";
import { parseInput } from "./parse";

const GROUP = "0b0f6a3e-7c1d-4a52-9d3e-1f2a3b4c5d6e";
const PAYMENT = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("paymentParamsSchema", () => {
  it("accepts a group id and a payment id that are UUIDs", () => {
    expect(
      parseInput(paymentParamsSchema, { groupId: GROUP, paymentId: PAYMENT }),
    ).toEqual({ groupId: GROUP, paymentId: PAYMENT });
  });

  it("rejects a payment id that is not a UUID", () => {
    expect(() =>
      parseInput(paymentParamsSchema, { groupId: GROUP, paymentId: "nope" }),
    ).toThrow(ValidationError);
  });
});

describe("createPaymentSchema", () => {
  const TO = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";

  it("accepts a recipient and a whole number of cents", () => {
    expect(
      parseInput(createPaymentSchema, { toUserId: TO, amountCents: 883 }),
    ).toEqual({ toUserId: TO, amountCents: 883 });
  });

  it.each([1, MAX_CENTS])("accepts %i cents", (amountCents) => {
    expect(
      parseInput(createPaymentSchema, { toUserId: TO, amountCents })
        .amountCents,
    ).toBe(amountCents);
  });

  it("drops a sender id sent in the body", () => {
    const parsed = parseInput(createPaymentSchema, {
      toUserId: TO,
      amountCents: 883,
      fromUserId: GROUP,
    });

    expect(parsed).not.toHaveProperty("fromUserId");
  });

  it("rejects a recipient that is not a UUID", () => {
    expect(() =>
      parseInput(createPaymentSchema, { toUserId: "sam", amountCents: 883 }),
    ).toThrow(
      expect.objectContaining({
        fields: { toUserId: "Choose who you paid." },
      }),
    );
  });

  it.each([
    ["0 cents", 0],
    ["below 0 cents", -1],
    ["part of a cent", 8.5],
    ["more than the largest amount", MAX_CENTS + 1],
    ["text", "883"],
  ])("rejects an amount of %s", (_case, amountCents) => {
    expect(() =>
      parseInput(createPaymentSchema, { toUserId: TO, amountCents }),
    ).toThrow(
      expect.objectContaining({
        fields: {
          amountCents: `Enter an amount from $0.01 to ${formatCents(MAX_CENTS)}.`,
        },
      }),
    );
  });
});
