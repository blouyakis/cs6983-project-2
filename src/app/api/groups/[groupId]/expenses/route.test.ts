// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { splitMessages } from "@/lib/domain/splits";
import { ForbiddenError, ValidationError } from "@/lib/http/errors";
import { GET, POST } from "./route";

const service = vi.hoisted(() => ({
  addExpense: vi.fn(),
  listGroupExpenses: vi.fn(),
}));
vi.mock("@/lib/services/expense-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const expense = {
  id: "1d5a6182-3333-4444-8555-b66677778888",
  groupId,
  description: "Electricity",
  amountCents: 1234,
  payerId: userId,
  spentOn: "2026-11-02",
  settled: false,
  createdAt: "2026-11-02T18:00:00+00:00",
  editedAt: null,
  shares: [
    { userId, shareCents: 617 },
    { userId: samId, shareCents: 617 },
  ],
};
const body = {
  description: "Electricity",
  amountCents: 1234,
  spentOn: "2026-11-02",
  mode: "even",
  sharedBy: [userId, samId],
};
const originalSecret = process.env.JWT_SECRET;

async function call(
  method: "GET" | "POST",
  { id = groupId, payload, signedIn = true, raw }: CallOptions = {},
) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/expenses`,
    {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      body: method === "POST" ? (raw ?? JSON.stringify(payload)) : undefined,
    },
  );
  const context = { params: Promise.resolve({ groupId: id }) };
  return method === "GET" ? GET(request, context) : POST(request, context);
}

type CallOptions = {
  id?: string;
  payload?: unknown;
  signedIn?: boolean;
  raw?: string;
};

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

describe("POST /api/groups/{groupId}/expenses", () => {
  it("adds the expense and returns it with 201", async () => {
    service.addExpense.mockResolvedValue(expense);

    const response = await call("POST", { payload: body });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ expense });
    expect(service.addExpense).toHaveBeenCalledWith(userId, groupId, body);
  });

  it("ignores a payer id in the body: the payer is the session user", async () => {
    service.addExpense.mockResolvedValue(expense);

    await call("POST", { payload: { ...body, payerId: samId } });

    expect(service.addExpense).toHaveBeenCalledWith(userId, groupId, body);
  });

  it.each([
    ["negative", -1],
    ["a fraction of a cent", 12.5],
    ["more than 2,147,483,647 cents", 2_147_483_648],
  ])("returns 400 for an amount that is %s", async (_, amountCents) => {
    const response = await call("POST", { payload: { ...body, amountCents } });

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      amountCents: splitMessages.amount,
    });
    expect(service.addExpense).not.toHaveBeenCalled();
  });

  it("returns 400 for a date in the future", async () => {
    const response = await call("POST", {
      payload: { ...body, spentOn: "2999-01-01" },
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      spentOn: "The day can't be in the future.",
    });
    expect(service.addExpense).not.toHaveBeenCalled();
  });

  it("returns the service's 400 for a sharer who isn't a member", async () => {
    service.addExpense.mockRejectedValue(
      new ValidationError("Check the highlighted fields.", {
        sharedBy: "Everyone sharing this cost must be in the group.",
      }),
    );

    const response = await call("POST", { payload: body });

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      sharedBy: "Everyone sharing this cost must be in the group.",
    });
  });

  it("returns 403 for a former member or an archived group", async () => {
    service.addExpense.mockRejectedValue(new ForbiddenError());

    const response = await call("POST", { payload: body });

    expect(response.status).toBe(403);
  });

  it("returns 400 for a group id that is not a UUID, without asking the service", async () => {
    const response = await call("POST", { id: "nope", payload: body });

    expect(response.status).toBe(400);
    expect(service.addExpense).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await call("POST", { raw: "{not json" });

    expect(response.status).toBe(400);
    expect(service.addExpense).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const response = await call("POST", { payload: body, signedIn: false });

    expect(response.status).toBe(401);
    expect(service.addExpense).not.toHaveBeenCalled();
  });
});

describe("GET /api/groups/{groupId}/expenses", () => {
  it("lists the group's expenses", async () => {
    service.listGroupExpenses.mockResolvedValue([expense]);

    const response = await call("GET");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expenses: [expense] });
    expect(service.listGroupExpenses).toHaveBeenCalledWith(userId, groupId);
  });

  it("returns 403 for someone who isn't in the group", async () => {
    service.listGroupExpenses.mockRejectedValue(new ForbiddenError());

    expect((await call("GET")).status).toBe(403);
  });

  it("returns 400 for a group id that is not a UUID", async () => {
    const response = await call("GET", { id: "nope" });

    expect(response.status).toBe(400);
    expect(service.listGroupExpenses).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const response = await call("GET", { signedIn: false });

    expect(response.status).toBe(401);
    expect(service.listGroupExpenses).not.toHaveBeenCalled();
  });
});
