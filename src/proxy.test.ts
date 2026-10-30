// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signSession } from "@/lib/auth/session";
import { config, proxy } from "./proxy";

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const originalSecret = process.env.JWT_SECRET;

function request(path: string, cookie?: string, method = "GET") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: cookie ? { cookie } : {},
  });
}

function isPassedThrough(response: Response) {
  return response.headers.get("x-middleware-next") === "1";
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("proxy", () => {
  it("sends a protected page without a session to login, remembering where it was going", async () => {
    const response = await proxy(request("/groups/abc?tab=bill"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/groups/abc?tab=bill");
    expect(location.searchParams.has("expired")).toBe(false);
  });

  it("marks the redirect as expired and clears a bad session cookie", async () => {
    const response = await proxy(request("/", "session=not-a-jwt"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("expired")).toBe("1");
    expect(response.headers.get("set-cookie")).toMatch(/session=;.*Max-Age=0/);
  });

  it("lets a protected page through with a valid session", async () => {
    const token = await signSession(userId);
    const response = await proxy(request("/", `session=${token}`));
    expect(isPassedThrough(response)).toBe(true);
  });

  it.each(["/login", "/register"])(
    "lets %s through without a session",
    async (path) => {
      const response = await proxy(request(path));
      expect(isPassedThrough(response)).toBe(true);
    },
  );

  it.each(["/login", "/register"])(
    "sends a signed-in user from %s to the overview",
    async (path) => {
      const token = await signSession(userId);
      const response = await proxy(request(path, `session=${token}`));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/");
    },
  );

  it.each(["/", "/groups", "/groups/abc/bill", "/expenses"])(
    "sends %s without a session to login",
    async (path) => {
      const response = await proxy(request(path));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe(
        "/login",
      );
    },
  );
});

describe("proxy for API requests", () => {
  it.each([
    ["GET", "/api/auth/me"],
    ["GET", "/api/groups/abc"],
    ["POST", "/api/groups/abc/expenses"],
    ["GET", "/api/overview"],
  ])("rejects %s %s without a session with 401", async (method, path) => {
    const response = await proxy(request(path, undefined, method));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Please log in to continue." },
    });
  });

  it("rejects an invalid token with 401 instead of a redirect", async () => {
    const response = await proxy(request("/api/groups", "session=not-a-jwt"));
    expect(response.status).toBe(401);
    expect(response.headers.has("location")).toBe(false);
  });

  it("rejects an expired token with the expiry message", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 25 * 60 * 60;
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 24 * 60 * 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const response = await proxy(request("/api/groups", `session=${expired}`));
    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toBe(
      "Your session has expired. Please log in again.",
    );
  });

  it("lets an API request through with a valid session", async () => {
    const token = await signSession(userId);
    const response = await proxy(
      request("/api/groups/abc", `session=${token}`),
    );
    expect(isPassedThrough(response)).toBe(true);
  });

  it.each(["/api/auth/register", "/api/auth/login", "/api/auth/logout"])(
    "lets POST %s through without a session",
    async (path) => {
      const response = await proxy(request(path, undefined, "POST"));
      expect(isPassedThrough(response)).toBe(true);
    },
  );

  it("does not let a signed-in user bounce off the auth API routes", async () => {
    const token = await signSession(userId);
    const response = await proxy(
      request("/api/auth/login", `session=${token}`, "POST"),
    );
    expect(isPassedThrough(response)).toBe(true);
  });
});

// Next 16.4 still exports this helper under its middleware name, not
// unstable_doesProxyMatch as the docs say.
describe("proxy matcher", () => {
  it.each(["/", "/groups/abc", "/api/groups/abc", "/api/auth/me"])(
    "runs for %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each(["/_next/static/chunk.js", "/favicon.ico", "/robots.txt"])(
    "skips %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
});
