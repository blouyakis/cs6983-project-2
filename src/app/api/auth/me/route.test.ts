// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { signSession } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/http/errors";
import { GET } from "./route";

const service = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/services/auth-service", () => service);

const secret = "test-secret-that-is-at-least-32-characters-long";
const sam = {
  id: "6f1c2d4e-1111-4222-8333-944455556666",
  email: "sam@example.com",
  name: "Sam Lee",
  createdAt: "2026-10-30T12:00:00+00:00",
  updatedAt: "2026-10-30T12:00:00+00:00",
};
const originalSecret = process.env.JWT_SECRET;

function get(cookie?: string) {
  return new NextRequest("http://localhost/api/auth/me", {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(() => {
  process.env.JWT_SECRET = secret;
  vi.resetAllMocks();
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("GET /api/auth/me", () => {
  it("returns the user for a valid session", async () => {
    service.getCurrentUser.mockResolvedValue(sam);
    const token = await signSession(sam.id);

    const response = await GET(get(`session=${token}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: sam });
    expect(service.getCurrentUser).toHaveBeenCalledWith(sam.id);
  });

  it("returns 401 without a session cookie", async () => {
    const response = await GET(get());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(service.getCurrentUser).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid token", async () => {
    const response = await GET(get("session=not-a-jwt"));
    expect(response.status).toBe(401);
    expect(service.getCurrentUser).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired token", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(sam.id)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 24 * 60 * 60)
      .sign(new TextEncoder().encode(secret));

    const response = await GET(get(`session=${expired}`));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Your session has expired. Please log in again.",
      },
    });
  });

  it("returns 401 when the session's user no longer exists", async () => {
    service.getCurrentUser.mockRejectedValue(new UnauthorizedError());
    const token = await signSession(sam.id);

    const response = await GET(get(`session=${token}`));

    expect(response.status).toBe(401);
  });
});
