// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signSession } from "@/lib/auth/session";
import { proxy } from "./proxy";

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const originalSecret = process.env.JWT_SECRET;

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, {
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
});
