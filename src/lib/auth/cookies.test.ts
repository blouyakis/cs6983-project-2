// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId } from "./cookies";
import { signSession } from "./session";

const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const originalSecret = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
  cookieStore.get.mockReset();
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("getSessionUserId", () => {
  it("returns the user id from a valid session cookie", async () => {
    const token = await signSession(userId);
    cookieStore.get.mockReturnValue({ name: "session", value: token });
    expect(await getSessionUserId()).toBe(userId);
    expect(cookieStore.get).toHaveBeenCalledWith("session");
  });

  it("returns null without a cookie or with a bad one", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getSessionUserId()).toBeNull();
    cookieStore.get.mockReturnValue({ name: "session", value: "bad" });
    expect(await getSessionUserId()).toBeNull();
  });

  it("still fails loudly when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    cookieStore.get.mockReturnValue({ name: "session", value: "anything" });
    await expect(getSessionUserId()).rejects.toThrow(/JWT_SECRET/);
  });
});
