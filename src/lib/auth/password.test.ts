// @vitest-environment node
import { getRounds } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("never returns the plain password", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).not.toContain("correct horse");
  });

  it("uses bcrypt cost factor 12", async () => {
    const hash = await hashPassword("correct horse");
    expect(getRounds(hash)).toBe(12);
  });

  it("salts each hash", async () => {
    const [first, second] = await Promise.all([
      hashPassword("correct horse"),
      hashPassword("correct horse"),
    ]);
    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("rejects any password when there is no hash", async () => {
    expect(await verifyPassword("correct horse", null)).toBe(false);
  });
});
