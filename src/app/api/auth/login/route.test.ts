// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/http/errors";
import { POST } from "./route";

const service = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/lib/services/auth-service", () => service);

const sam = {
  id: "6f1c2d4e-1111-4222-8333-944455556666",
  email: "sam@example.com",
  name: "Sam Lee",
  createdAt: "2026-10-30T12:00:00+00:00",
  updatedAt: "2026-10-30T12:00:00+00:00",
};

function post(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/auth/login", () => {
  it("returns the user and sets the session cookie", async () => {
    service.login.mockResolvedValue({ user: sam, token: "signed.jwt" });

    const response = await POST(
      post({ email: "SAM@example.com", password: "correct horse" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: sam });
    expect(service.login).toHaveBeenCalledWith({
      email: "sam@example.com",
      password: "correct horse",
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^session=signed\.jwt;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("returns 401 with the generic message for bad credentials", async () => {
    service.login.mockRejectedValue(
      new UnauthorizedError("Email or password is incorrect."),
    );

    const response = await POST(
      post({ email: "sam@example.com", password: "wrong horse" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Email or password is incorrect.",
      },
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 400 when a field is missing", async () => {
    const response = await POST(post({ email: "sam@example.com" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      password: "Enter your password.",
    });
    expect(service.login).not.toHaveBeenCalled();
  });
});
