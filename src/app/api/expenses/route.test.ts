// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/http/errors";
import { GET } from "./route";

const service = vi.hoisted(() => ({ listExpenseHistory: vi.fn() }));
vi.mock("@/lib/services/expense-history-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const originalSecret = process.env.JWT_SECRET;

const row = {
  id: "9c8d7e6f-4444-4555-8666-c77788889999",
  groupId,
  groupName: "Flat",
  isPersonal: false,
  description: "Groceries",
  amountCents: 3001,
  payerId: samId,
  spentOn: "2026-10-20",
  settled: false,
  createdAt: "2026-10-20T18:00:00+00:00",
  editedAt: null,
  shares: [
    { userId: samId, shareCents: 1501 },
    { userId, shareCents: 1500 },
  ],
  yourShareCents: 1500,
  editLock: "not-payer",
};

async function get(query = "", signedIn = true) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  return GET(
    new NextRequest(`http://localhost/api/expenses${query}`, {
      headers: cookie ? { cookie } : {},
    }),
  );
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
  vi.resetAllMocks();
  service.listExpenseHistory.mockResolvedValue([row]);
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("GET /api/expenses", () => {
  it("returns the session user's expense history with no filters", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expenses: [row] });
    expect(service.listExpenseHistory).toHaveBeenCalledWith(userId, {});
  });

  it.each([
    ["groupId", `?groupId=${groupId}`, { groupId }],
    ["paidBy", `?paidBy=${samId}`, { paidBy: samId }],
    ["from", "?from=2026-10-01", { from: "2026-10-01" }],
    ["to", "?to=2026-10-31", { to: "2026-10-31" }],
  ])("passes %s on its own to the service", async (_name, query, filters) => {
    await get(query);

    expect(service.listExpenseHistory).toHaveBeenCalledWith(userId, filters);
  });

  it("passes all four filters together", async () => {
    await get(
      `?groupId=${groupId}&paidBy=${samId}&from=2026-10-01&to=2026-10-31`,
    );

    expect(service.listExpenseHistory).toHaveBeenCalledWith(userId, {
      groupId,
      paidBy: samId,
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("reads an empty filter as not set", async () => {
    await get("?groupId=&paidBy=&from=&to=2026-10-31");

    expect(service.listExpenseHistory).toHaveBeenCalledWith(userId, {
      to: "2026-10-31",
    });
  });

  it("never takes the user from the query", async () => {
    await get(`?userId=${samId}`);

    expect(service.listExpenseHistory).toHaveBeenCalledWith(userId, {});
  });

  it.each([
    ["a From after To", "?from=2026-11-02&to=2026-11-01", "to"],
    ["a From that isn't a date", "?from=yesterday", "from"],
    ["a To that isn't a real day", "?to=2026-02-30", "to"],
    ["a groupId that isn't a UUID", "?groupId=flat", "groupId"],
    ["a paidBy that isn't a UUID", "?paidBy=sam", "paidBy"],
  ])("is 400 for %s, on that field", async (_name, query, field) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toHaveProperty(field);
    expect(service.listExpenseHistory).not.toHaveBeenCalled();
  });

  it("is 403 for a groupId of a group the user isn't in", async () => {
    service.listExpenseHistory.mockRejectedValue(new ForbiddenError());

    const response = await get(`?groupId=${groupId}`);

    expect(response.status).toBe(403);
  });

  it("is 401 without a session", async () => {
    const response = await get("", false);

    expect(response.status).toBe(401);
    expect(service.listExpenseHistory).not.toHaveBeenCalled();
  });
});
