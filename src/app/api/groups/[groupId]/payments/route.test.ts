// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ForbiddenError, ValidationError } from "@/lib/http/errors";
import { GET, POST } from "./route";

const service = vi.hoisted(() => ({
  recordDirectPayment: vi.fn(),
  listPayments: vi.fn(),
}));
vi.mock("@/lib/services/payment-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const originalSecret = process.env.JWT_SECRET;

function context(id: string) {
  return { params: Promise.resolve({ groupId: id }) };
}

function post(id: string, body: unknown, cookie?: string) {
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/payments`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  return POST(request, context(id));
}

function get(id: string, cookie?: string) {
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/payments`,
    { headers: cookie ? { cookie } : {} },
  );
  return GET(request, context(id));
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

describe("POST /api/groups/{groupId}/payments", () => {
  it("records a payment from the session user and returns 201", async () => {
    const payment = { id: "p1", status: "paid" };
    service.recordDirectPayment.mockResolvedValue(payment);
    const token = await signSession(userId);

    const response = await post(
      groupId,
      { toUserId: samId, amountCents: 883, fromUserId: samId },
      `session=${token}`,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ payment });
    expect(service.recordDirectPayment).toHaveBeenCalledWith(userId, groupId, {
      toUserId: samId,
      amountCents: 883,
    });
  });

  it("returns 400 for an amount of 0 without calling the service", async () => {
    const token = await signSession(userId);

    const response = await post(
      groupId,
      { toUserId: samId, amountCents: 0 },
      `session=${token}`,
    );

    expect(response.status).toBe(400);
    expect(service.recordDirectPayment).not.toHaveBeenCalled();
  });

  it("returns 400 when the service refuses the recipient", async () => {
    service.recordDirectPayment.mockRejectedValue(
      new ValidationError("Check the highlighted fields.", {
        toUserId: "You can't pay yourself.",
      }),
    );
    const token = await signSession(userId);

    const response = await post(
      groupId,
      { toUserId: userId, amountCents: 883 },
      `session=${token}`,
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for a group id that isn't a UUID", async () => {
    const token = await signSession(userId);

    const response = await post(
      "nope",
      { toUserId: samId, amountCents: 883 },
      `session=${token}`,
    );

    expect(response.status).toBe(400);
  });

  it("returns 401 without a session", async () => {
    const response = await post(groupId, { toUserId: samId, amountCents: 883 });

    expect(response.status).toBe(401);
    expect(service.recordDirectPayment).not.toHaveBeenCalled();
  });

  it("returns 403 without write access", async () => {
    service.recordDirectPayment.mockRejectedValue(new ForbiddenError("no"));
    const token = await signSession(userId);

    const response = await post(
      groupId,
      { toUserId: samId, amountCents: 883 },
      `session=${token}`,
    );

    expect(response.status).toBe(403);
  });
});

describe("GET /api/groups/{groupId}/payments", () => {
  it("lists the group's payments", async () => {
    const payments = [{ id: "p1", status: "confirmed" }];
    service.listPayments.mockResolvedValue(payments);
    const token = await signSession(userId);

    const response = await get(groupId, `session=${token}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payments });
    expect(service.listPayments).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 401 without a session", async () => {
    expect((await get(groupId)).status).toBe(401);
  });

  it("returns 403 for someone outside the group", async () => {
    service.listPayments.mockRejectedValue(new ForbiddenError("no"));
    const token = await signSession(userId);

    expect((await get(groupId, `session=${token}`)).status).toBe(403);
  });
});
