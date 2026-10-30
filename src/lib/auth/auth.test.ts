// @vitest-environment node
import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { loginSchema, registerSchema } from "./schemas";
import { signToken, verifyToken } from "./token";

beforeAll(() => {
  process.env.JWT_SECRET = "x".repeat(32);
});

describe("password hashing", () => {
  it("hashes without storing plain text and verifies", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("schemas", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const r = registerSchema.safeParse({ email: "a@b.co", password: "short" });
    expect(r.success).toBe(false);
  });

  it("accepts 8 characters and normalizes email", () => {
    const r = registerSchema.safeParse({
      email: "  A@B.Co ",
      password: "12345678",
    });
    expect(r.success && r.data.email).toBe("a@b.co");
  });

  it("rejects invalid emails", () => {
    expect(
      loginSchema.safeParse({ email: "nope", password: "x" }).success,
    ).toBe(false);
  });
});

describe("tokens", () => {
  it("round-trips the user id", async () => {
    expect(await verifyToken(await signToken("user-1"))).toBe("user-1");
  });

  it("rejects garbage and tampered tokens", async () => {
    expect(await verifyToken("not.a.jwt")).toBeNull();
    const token = await signToken("user-1");
    expect(await verifyToken(token.slice(0, -2) + "xx")).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect(await verifyToken(expired)).toBeNull();
  });

  it("rejects tokens signed with another secret", async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("y".repeat(32)));
    expect(await verifyToken(forged)).toBeNull();
  });
});
