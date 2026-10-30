// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/http/errors";
import { POST } from "./route";

const service = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock("@/lib/services/auth-service", () => service);

const sam = {
  id: "6f1c2d4e-1111-4222-8333-944455556666",
  email: "sam@example.com",
  name: "Sam Lee",
  createdAt: "2026-10-30T12:00:00+00:00",
  updatedAt: "2026-10-30T12:00:00+00:00",
};

function post(body: string) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/auth/register", () => {
  it("creates the account, returns the user and sets the session cookie", async () => {
    service.register.mockResolvedValue({ user: sam, token: "signed.jwt" });

    const response = await POST(
      post(
        JSON.stringify({
          name: "Sam Lee",
          email: "Sam@Example.com",
          password: "correct horse",
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ user: sam });
    expect(service.register).toHaveBeenCalledWith({
      name: "Sam Lee",
      email: "sam@example.com",
      password: "correct horse",
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^session=signed\.jwt;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=86400/);
  });

  it("returns 400 with a field message for a short password", async () => {
    const response = await POST(
      post(
        JSON.stringify({
          name: "Sam",
          email: "sam@example.com",
          password: "short",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { password: "Password must be at least 8 characters." },
      },
    });
    expect(service.register).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 400 when the body is not JSON", async () => {
    const response = await POST(post("{not json"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 for an email that already has an account", async () => {
    service.register.mockRejectedValue(
      new ConflictError("An account with this email already exists."),
    );

    const response = await POST(
      post(
        JSON.stringify({
          name: "Sam",
          email: "sam@example.com",
          password: "correct horse",
        }),
      ),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "CONFLICT",
        message: "An account with this email already exists.",
      },
    });
  });
});
