// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { GET, POST } from "./route";

const service = vi.hoisted(() => ({
  createGroup: vi.fn(),
  listGroups: vi.fn(),
}));
vi.mock("@/lib/services/group-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const flat = {
  id: "0b7e8a10-2222-4333-8444-a55566667777",
  name: "🏠 Flat",
  isPersonal: false,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
  members: [{ userId, name: "Ana", defaultShareWeight: 1 }],
};
const originalSecret = process.env.JWT_SECRET;

function request(method: "GET" | "POST", cookie?: string, body?: string) {
  return new NextRequest("http://localhost/api/groups", {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body,
  });
}

async function sessionCookie() {
  return `session=${await signSession(userId)}`;
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

describe("GET /api/groups", () => {
  it("lists the session user's groups", async () => {
    const summary = { ...flat, leftAt: null, readOnly: false };
    service.listGroups.mockResolvedValue([summary]);

    const response = await GET(request("GET", await sessionCookie()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ groups: [summary] });
    expect(service.listGroups).toHaveBeenCalledWith(userId);
  });

  it("returns 401 without a session", async () => {
    const response = await GET(request("GET"));

    expect(response.status).toBe(401);
    expect(service.listGroups).not.toHaveBeenCalled();
  });
});

describe("POST /api/groups", () => {
  it("creates a group for the session user and returns 201", async () => {
    service.createGroup.mockResolvedValue(flat);

    const response = await POST(
      request(
        "POST",
        await sessionCookie(),
        JSON.stringify({ name: " 🏠 Flat " }),
      ),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ group: flat });
    expect(service.createGroup).toHaveBeenCalledWith(userId, {
      name: "🏠 Flat",
    });
  });

  it("returns 400 for an empty name, without asking the service", async () => {
    const response = await POST(
      request("POST", await sessionCookie(), JSON.stringify({ name: " " })),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      name: "Enter a group name.",
    });
    expect(service.createGroup).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await POST(
      request("POST", await sessionCookie(), "not json"),
    );

    expect(response.status).toBe(400);
    expect(service.createGroup).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const response = await POST(
      request("POST", undefined, JSON.stringify({ name: "Flat" })),
    );

    expect(response.status).toBe(401);
    expect(service.createGroup).not.toHaveBeenCalled();
  });
});
