// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import { DELETE, PATCH } from "./route";

const service = vi.hoisted(() => ({
  editExpense: vi.fn(),
  removeExpense: vi.fn(),
}));
vi.mock("@/lib/services/expense-edit-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const expenseId = "1d5a6182-3333-4444-8555-b66677778888";
const originalSecret = process.env.JWT_SECRET;

const body = {
  description: "Power",
  amountCents: 3000,
  spentOn: "2026-11-03",
  mode: "even",
  sharedBy: [userId, samId],
};

const edited = {
  id: expenseId,
  groupId,
  description: "Power",
  amountCents: 3000,
  payerId: userId,
  spentOn: "2026-11-03",
  settled: false,
  createdAt: "2026-11-02T18:00:00+00:00",
  editedAt: "2026-11-04T10:00:00+00:00",
  shares: [
    { userId, shareCents: 1500 },
    { userId: samId, shareCents: 1500 },
  ],
};

type Ids = { groupId: string; expenseId: string };
const ids: Ids = { groupId, expenseId };

async function patch(input: unknown, params: Ids = ids, signedIn = true) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${params.groupId}/expenses/${params.expenseId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(input),
    },
  );
  return PATCH(request, { params: Promise.resolve(params) });
}

async function del(params: Ids = ids, signedIn = true) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${params.groupId}/expenses/${params.expenseId}`,
    { method: "DELETE", headers: cookie ? { cookie } : {} },
  );
  return DELETE(request, { params: Promise.resolve(params) });
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
  vi.resetAllMocks();
  service.editExpense.mockResolvedValue(edited);
  service.removeExpense.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("PATCH /api/groups/{groupId}/expenses/{expenseId}", () => {
  it("edits the expense as the session user and returns it", async () => {
    const response = await patch(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expense: edited });
    expect(service.editExpense).toHaveBeenCalledWith(
      userId,
      groupId,
      expenseId,
      body,
    );
  });

  it("drops a payerId in the body, because the payer can't be changed", async () => {
    await patch({ ...body, payerId: samId });

    expect(service.editExpense.mock.calls[0][3]).not.toHaveProperty("payerId");
  });

  it("returns 401 without a session", async () => {
    const response = await patch(body, ids, false);

    expect(response.status).toBe(401);
    expect(service.editExpense).not.toHaveBeenCalled();
  });

  it("returns 400 with the field for a bad body, without asking the service", async () => {
    const response = await patch({ ...body, amountCents: -1 });

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toHaveProperty("amountCents");
    expect(service.editExpense).not.toHaveBeenCalled();
  });

  it("returns 400 for an expense id that is not a UUID", async () => {
    const response = await patch(body, { groupId, expenseId: "nope" });

    expect(response.status).toBe(400);
    expect(service.editExpense).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-payer and 409 for a settled expense", async () => {
    service.editExpense.mockRejectedValueOnce(new ForbiddenError("no"));
    expect((await patch(body)).status).toBe(403);

    service.editExpense.mockRejectedValueOnce(new ConflictError("settled"));
    expect((await patch(body)).status).toBe(409);
  });
});

describe("DELETE /api/groups/{groupId}/expenses/{expenseId}", () => {
  it("deletes the expense and returns 204", async () => {
    const response = await del();

    expect(response.status).toBe(204);
    expect(service.removeExpense).toHaveBeenCalledWith(
      userId,
      groupId,
      expenseId,
    );
  });

  it("returns 401 without a session", async () => {
    const response = await del(ids, false);

    expect(response.status).toBe(401);
    expect(service.removeExpense).not.toHaveBeenCalled();
  });

  it("returns 400 for an id that is not a UUID", async () => {
    const response = await del({ groupId: "flat", expenseId });

    expect(response.status).toBe(400);
    expect(service.removeExpense).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-payer and 409 for a settled expense", async () => {
    service.removeExpense.mockRejectedValueOnce(new ForbiddenError("no"));
    expect((await del()).status).toBe(403);

    service.removeExpense.mockRejectedValueOnce(new ConflictError("settled"));
    expect((await del()).status).toBe(409);
  });
});
