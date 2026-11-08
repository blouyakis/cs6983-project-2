// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { GET } from "./route";

const service = vi.hoisted(() => ({ listSidebarGroups: vi.fn() }));
vi.mock("@/lib/services/sidebar-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const originalSecret = process.env.JWT_SECRET;

const groups = [
  { id: "a", name: "🏠 Dorm 4B", isPersonal: false, balanceCents: -3100 },
  { id: "p", name: "Personal space", isPersonal: true },
];

function request(cookie?: string) {
  return new NextRequest("http://localhost/api/sidebar-groups", {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
  vi.resetAllMocks();
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("GET /api/sidebar-groups", () => {
  it("returns the session user's sidebar groups", async () => {
    service.listSidebarGroups.mockResolvedValue(groups);

    const response = await GET(request(`session=${await signSession(userId)}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ groups });
    expect(service.listSidebarGroups).toHaveBeenCalledWith(userId);
  });

  it("is never cached, so each navigation gets the current balances", async () => {
    service.listSidebarGroups.mockResolvedValue(groups);

    const response = await GET(request(`session=${await signSession(userId)}`));

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 401 without a session, without asking the service", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(service.listSidebarGroups).not.toHaveBeenCalled();
  });

  it("returns 500 in the usual error shape when the groups can't be loaded", async () => {
    service.listSidebarGroups.mockRejectedValue(new Error("database down"));

    const response = await GET(request(`session=${await signSession(userId)}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toHaveProperty("error");
  });
});
