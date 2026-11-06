import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/http/errors";
import { paymentParamsSchema } from "./payment";
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
