// @vitest-environment node
import { SignJWT, decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/http/errors";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "./session";

const secret = "test-secret-that-is-at-least-32-characters-long";
const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const originalSecret = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = secret;
});

afterEach(() => {
  vi.useRealTimers();
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("session cookie settings", () => {
  it("is an httpOnly, Secure, SameSite=Lax cookie named session for 24 hours", () => {
    expect(SESSION_COOKIE).toBe("session");
    expect(SESSION_MAX_AGE_SECONDS).toBe(24 * 60 * 60);
    expect(sessionCookieOptions).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  });
});

describe("signSession", () => {
  it("holds only the user id and expires after 24 hours", async () => {
    const token = await signSession(userId);
    const claims = decodeJwt(token);
    expect(claims.sub).toBe(userId);
    expect(claims.exp! - claims.iat!).toBe(SESSION_MAX_AGE_SECONDS);
    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "sub"]);
  });

  it("refuses to sign without a long enough JWT_SECRET", async () => {
    process.env.JWT_SECRET = "short";
    await expect(signSession(userId)).rejects.toThrow(/JWT_SECRET/);
    delete process.env.JWT_SECRET;
    await expect(signSession(userId)).rejects.toThrow(/JWT_SECRET/);
  });
});

describe("verifySession", () => {
  it("returns the user id from a valid token", async () => {
    const token = await signSession(userId);
    expect(await verifySession(token)).toBe(userId);
  });

  it("rejects a missing token", async () => {
    await expect(verifySession(undefined)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects a garbage token", async () => {
    await expect(verifySession("not-a-jwt")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects a token signed with another secret", async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(new TextEncoder().encode("another-secret-that-is-32-characters!!"));
    await expect(verifySession(forged)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects a token without a subject", async () => {
    const noSubject = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(new TextEncoder().encode(secret));
    await expect(verifySession(noSubject)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("rejects a token once 24 hours have passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    const token = await signSession(userId);
    vi.setSystemTime(new Date("2026-10-31T12:00:01Z"));
    await expect(verifySession(token)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
