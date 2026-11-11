// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import { POST } from "./route";

const service = vi.hoisted(() => ({ leaveGroup: vi.fn() }));
vi.mock("@/lib/services/group-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const originalSecret = process.env.JWT_SECRET;

function post(id: string, cookie?: string) {
  const request = new NextRequest(`http://localhost/api/groups/${id}/leave`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
  return POST(request, { params: Promise.resolve({ groupId: id }) });
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

describe("POST /api/groups/{groupId}/leave", () => {
  it("leaves the group as the session user with 204 (#22)", async () => {
    const token = await signSession(userId);

    const response = await post(groupId, `session=${token}`);

    expect(response.status).toBe(204);
    expect(service.leaveGroup).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 409 with the reason while the balance isn't zero", async () => {
    const message =
      "Settle up first: you can leave once your balance in this group is $0.00.";
    service.leaveGroup.mockRejectedValue(new ConflictError(message));
    const token = await signSession(userId);

    const response = await post(groupId, `session=${token}`);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "CONFLICT", message },
    });
  });

  it("returns 403 for a personal space, a former member or a stranger", async () => {
    service.leaveGroup.mockRejectedValue(new ForbiddenError());
    const token = await signSession(userId);

    expect((await post(groupId, `session=${token}`)).status).toBe(403);
  });

  it("returns 400 for a group id that isn't a UUID, leaving nothing", async () => {
    const token = await signSession(userId);

    expect((await post("not-a-uuid", `session=${token}`)).status).toBe(400);
    expect(service.leaveGroup).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    expect((await post(groupId)).status).toBe(401);
    expect(service.leaveGroup).not.toHaveBeenCalled();
  });
});
