// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/http/errors";
import { GET } from "./route";

const service = vi.hoisted(() => ({ getGroup: vi.fn() }));
vi.mock("@/lib/services/group-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const flat = {
  id: groupId,
  name: "Flat",
  isPersonal: false,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
};
const originalSecret = process.env.JWT_SECRET;

function get(id: string, cookie?: string) {
  const request = new NextRequest(`http://localhost/api/groups/${id}`, {
    headers: cookie ? { cookie } : {},
  });
  return GET(request, { params: Promise.resolve({ groupId: id }) });
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

describe("GET /api/groups/{groupId}", () => {
  it("returns the group for a member", async () => {
    service.getGroup.mockResolvedValue(flat);
    const token = await signSession(userId);

    const response = await get(groupId, `session=${token}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ group: flat });
    expect(service.getGroup).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 401 without a session", async () => {
    const response = await get(groupId);

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(service.getGroup).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not allowed in the group", async () => {
    service.getGroup.mockRejectedValue(
      new ForbiddenError("You are not a member of this group."),
    );
    const token = await signSession(userId);

    const response = await get(groupId, `session=${token}`);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You are not a member of this group.",
      },
    });
  });

  it("returns 400 for an id that is not a UUID, without asking the service", async () => {
    const token = await signSession(userId);

    const response = await get("not-a-uuid", `session=${token}`);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(service.getGroup).not.toHaveBeenCalled();
  });
});
