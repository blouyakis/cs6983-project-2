// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";
import { GET } from "./route";

const service = vi.hoisted(() => ({ getMyBill: vi.fn() }));
vi.mock("@/lib/services/bill-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const settlementId = "4d5e6f7a-6666-4777-8888-e99900001111";
const originalSecret = process.env.JWT_SECRET;

const bill = {
  settlementId: null,
  pastPeriods: [],
  lines: [],
  owed: [{ userId: "7a2d3e5f-1111-4222-8333-944455556666", owedCents: 883 }],
};

function get(id: string, query = "", cookie?: string) {
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/bills/me${query}`,
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

describe("GET /api/groups/{groupId}/bills/me", () => {
  it("returns the session user's bill for the current period", async () => {
    service.getMyBill.mockResolvedValue(bill);
    const token = await signSession(userId);

    const response = await get(groupId, "", `session=${token}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(bill);
    expect(service.getMyBill).toHaveBeenCalledWith(userId, groupId, null);
  });

  it("asks for a past period with ?settlementId=", async () => {
    service.getMyBill.mockResolvedValue({ ...bill, settlementId });
    const token = await signSession(userId);

    const response = await get(
      groupId,
      `?settlementId=${settlementId}`,
      `session=${token}`,
    );

    expect(response.status).toBe(200);
    expect(service.getMyBill).toHaveBeenCalledWith(
      userId,
      groupId,
      settlementId,
    );
  });

  it("returns 400 for a settlementId that is not a UUID", async () => {
    const token = await signSession(userId);

    const response = await get(
      groupId,
      "?settlementId=last-month",
      `session=${token}`,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toHaveProperty("settlementId");
    expect(service.getMyBill).not.toHaveBeenCalled();
  });

  it("returns 400 for a group id that is not a UUID", async () => {
    const token = await signSession(userId);

    const response = await get("not-a-uuid", "", `session=${token}`);

    expect(response.status).toBe(400);
    expect(service.getMyBill).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const response = await get(groupId);

    expect(response.status).toBe(401);
    expect(service.getMyBill).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not allowed in the group", async () => {
    service.getMyBill.mockRejectedValue(new ForbiddenError("no"));
    const token = await signSession(userId);

    const response = await get(groupId, "", `session=${token}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 for a period that isn't one of the group's closed ones", async () => {
    service.getMyBill.mockRejectedValue(new NotFoundError("no period"));
    const token = await signSession(userId);

    const response = await get(
      groupId,
      `?settlementId=${settlementId}`,
      `session=${token}`,
    );

    expect(response.status).toBe(404);
  });
});
