// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import { POST } from "./route";

const service = vi.hoisted(() => ({ confirmPaymentReceived: vi.fn() }));
vi.mock("@/lib/services/payment-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const paymentId = "9c8d7e6f-6666-4777-8888-e99900001111";
const originalSecret = process.env.JWT_SECRET;

function post(id: string, payment: string, cookie?: string) {
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/payments/${payment}/confirm`,
    { method: "POST", headers: cookie ? { cookie } : {} },
  );
  return POST(request, {
    params: Promise.resolve({ groupId: id, paymentId: payment }),
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

describe("POST /api/groups/{groupId}/payments/{paymentId}/confirm", () => {
  it("confirms the payment and says whether the period closed", async () => {
    const payment = { id: paymentId, status: "confirmed" };
    service.confirmPaymentReceived.mockResolvedValue({ payment, closed: true });
    const token = await signSession(userId);

    const response = await post(groupId, paymentId, `session=${token}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ payment, closed: true });
    expect(service.confirmPaymentReceived).toHaveBeenCalledWith(
      userId,
      groupId,
      paymentId,
    );
  });

  it("returns 403 for anyone but the recipient", async () => {
    service.confirmPaymentReceived.mockRejectedValue(new ForbiddenError("no"));
    const token = await signSession(userId);

    expect((await post(groupId, paymentId, `session=${token}`)).status).toBe(
      403,
    );
  });

  it("returns 409 when it isn't marked paid", async () => {
    service.confirmPaymentReceived.mockRejectedValue(
      new ConflictError("not paid"),
    );
    const token = await signSession(userId);

    expect((await post(groupId, paymentId, `session=${token}`)).status).toBe(
      409,
    );
  });

  it("returns 400 for a payment id that is not a UUID", async () => {
    const token = await signSession(userId);

    expect((await post(groupId, "nope", `session=${token}`)).status).toBe(400);
    expect(service.confirmPaymentReceived).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    expect((await post(groupId, paymentId)).status).toBe(401);
  });
});
