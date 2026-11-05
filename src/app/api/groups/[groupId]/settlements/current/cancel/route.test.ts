// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
import { POST } from "./route";

const service = vi.hoisted(() => ({ cancelSettleUp: vi.fn() }));
vi.mock("@/lib/services/settlement-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const originalSecret = process.env.JWT_SECRET;

function post(id: string, cookie?: string) {
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/settlements/current/cancel`,
    { method: "POST", headers: cookie ? { cookie } : {} },
  );
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

describe("POST /api/groups/{groupId}/settlements/current/cancel", () => {
  it("cancels the open settle-up with 204", async () => {
    const token = await signSession(userId);

    const response = await post(groupId, `session=${token}`);

    expect(response.status).toBe(204);
    expect(service.cancelSettleUp).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 409 once a payment is marked paid", async () => {
    service.cancelSettleUp.mockRejectedValue(new ConflictError("paid"));
    const token = await signSession(userId);

    expect((await post(groupId, `session=${token}`)).status).toBe(409);
  });

  it("returns 404 without an open settle-up", async () => {
    service.cancelSettleUp.mockRejectedValue(new NotFoundError("none"));
    const token = await signSession(userId);

    expect((await post(groupId, `session=${token}`)).status).toBe(404);
  });

  it("returns 401 without a session", async () => {
    expect((await post(groupId)).status).toBe(401);
    expect(service.cancelSettleUp).not.toHaveBeenCalled();
  });
});
