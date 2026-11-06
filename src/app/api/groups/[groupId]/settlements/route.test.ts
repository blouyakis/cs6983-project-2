// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import { GET, POST } from "./route";

const service = vi.hoisted(() => ({
  startSettleUp: vi.fn(),
  listPastPeriods: vi.fn(),
}));
vi.mock("@/lib/services/settlement-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const originalSecret = process.env.JWT_SECRET;

const settleUp = {
  id: "5e6f7a8b-5555-4666-8777-d88899990000",
  groupId,
  status: "open",
  startedBy: userId,
  startedAt: "2026-11-01T10:00:00+00:00",
  closedAt: null,
  payments: [],
};

function call(method: "GET" | "POST", id: string, cookie?: string) {
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/settlements`,
    { method, headers: cookie ? { cookie } : {} },
  );
  const context = { params: Promise.resolve({ groupId: id }) };
  return method === "GET" ? GET(request, context) : POST(request, context);
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

describe("POST /api/groups/{groupId}/settlements", () => {
  it("starts a settle-up and returns it with 201", async () => {
    service.startSettleUp.mockResolvedValue(settleUp);
    const token = await signSession(userId);

    const response = await call("POST", groupId, `session=${token}`);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ settleUp });
    expect(service.startSettleUp).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 409 when one is already open", async () => {
    service.startSettleUp.mockRejectedValue(new ConflictError("open"));
    const token = await signSession(userId);

    const response = await call("POST", groupId, `session=${token}`);

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CONFLICT");
  });

  it("returns 401 without a session", async () => {
    const response = await call("POST", groupId);

    expect(response.status).toBe(401);
    expect(service.startSettleUp).not.toHaveBeenCalled();
  });

  it("returns 400 for an id that is not a UUID", async () => {
    const token = await signSession(userId);

    const response = await call("POST", "nope", `session=${token}`);

    expect(response.status).toBe(400);
    expect(service.startSettleUp).not.toHaveBeenCalled();
  });
});

describe("GET /api/groups/{groupId}/settlements", () => {
  it("lists the closed periods", async () => {
    const periods = [
      { ...settleUp, status: "closed", expenseCount: 3, paymentCount: 2 },
    ];
    service.listPastPeriods.mockResolvedValue(periods);
    const token = await signSession(userId);

    const response = await call("GET", groupId, `session=${token}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ periods });
    expect(service.listPastPeriods).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 403 for someone outside the group", async () => {
    service.listPastPeriods.mockRejectedValue(new ForbiddenError());
    const token = await signSession(userId);

    const response = await call("GET", groupId, `session=${token}`);

    expect(response.status).toBe(403);
  });

  it("returns 401 without a session", async () => {
    expect((await call("GET", groupId)).status).toBe(401);
  });
});
