import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/http/errors";
import { loginSchema, registerSchema } from "./auth";
import { parseInput } from "./parse";

const valid = {
  name: "Sam Lee",
  email: "Sam@Example.com",
  password: "correct horse",
};

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

describe("registerSchema", () => {
  it("trims the name and stores the email lowercase", () => {
    expect(
      parseInput(registerSchema, {
        ...valid,
        name: "  Sam Lee ",
        email: " Sam@Example.COM ",
      }),
    ).toEqual({
      name: "Sam Lee",
      email: "sam@example.com",
      password: "correct horse",
    });
  });

  it("rejects a password shorter than 8 characters with a clear message", () => {
    expect(
      fieldErrorsFor(registerSchema, { ...valid, password: "short" }),
    ).toEqual({
      password: "Password must be at least 8 characters.",
    });
  });

  it("accepts a password of exactly 8 characters", () => {
    expect(
      parseInput(registerSchema, { ...valid, password: "12345678" }).password,
    ).toBe("12345678");
  });

  it("rejects a password longer than bcrypt can hash", () => {
    expect(
      fieldErrorsFor(registerSchema, { ...valid, password: "é".repeat(37) }),
    ).toEqual({ password: "Password must be at most 72 bytes." });
  });

  it("rejects an invalid email and a blank name", () => {
    expect(
      fieldErrorsFor(registerSchema, {
        ...valid,
        email: "not-an-email",
        name: "  ",
      }),
    ).toEqual({
      email: "Enter a valid email address.",
      name: "Enter your name.",
    });
  });

  it("rejects a body that is not an object", () => {
    expect(fieldErrorsFor(registerSchema, "nope")).toEqual({});
  });
});

describe("loginSchema", () => {
  it("lowercases the email and keeps the password as typed", () => {
    expect(
      parseInput(loginSchema, {
        email: "SAM@example.com",
        password: " pass word ",
      }),
    ).toEqual({ email: "sam@example.com", password: " pass word " });
  });

  it("requires both fields", () => {
    expect(fieldErrorsFor(loginSchema, {})).toEqual({
      email: "Enter a valid email address.",
      password: "Enter your password.",
    });
  });
});
