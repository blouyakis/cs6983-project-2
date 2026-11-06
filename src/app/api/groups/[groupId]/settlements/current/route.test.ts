// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/http/errors";
import { GET } from "./route";

const service = vi.hoisted(() => ({ getCurrentSettleUp: vi.fn() }));
vi.mock("@/lib/services/settlement-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const originalSecret = process.env.JWT_SECRET;

function get(id: string, cookie?: string) {
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/settlements/current`,
    { headers: cookie ? { cookie } : {} },
  );
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

describe("GET /api/groups/{groupId}/settlements/current", () => {
  it("returns the open settle-up with its payments", async () => {
    const settleUp = { id: "s", status: "open", payments: [] };
    service.getCurrentSettleUp.mockResolvedValue(settleUp);
    const token = await signSession(userId);

    const response = await get(groupId, `session=${token}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ settleUp });
    expect(service.getCurrentSettleUp).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 404 when none is open", async () => {
    service.getCurrentSettleUp.mockRejectedValue(new NotFoundError("none"));
    const token = await signSession(userId);

    const response = await get(groupId, `session=${token}`);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("returns 401 without a session", async () => {
    expect((await get(groupId)).status).toBe(401);
  });

  it("returns 400 for an id that is not a UUID", async () => {
    const token = await signSession(userId);

    expect((await get("nope", `session=${token}`)).status).toBe(400);
    expect(service.getCurrentSettleUp).not.toHaveBeenCalled();
  });
});
