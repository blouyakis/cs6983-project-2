// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import { POST } from "./route";

const service = vi.hoisted(() => ({ completeListItem: vi.fn() }));
vi.mock("@/lib/services/list-item-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const itemId = "1d5a6182-3333-4444-8555-b66677778888";
const item = {
  id: itemId,
  groupId,
  title: "Oat milk",
  quantity: null,
  note: null,
  estimatedCents: 450,
  status: "done",
  addedBy: userId,
  completedBy: userId,
  completedAt: "2026-11-04T19:00:00+00:00",
  expenseId: "5e4f3a2b-5555-4666-8777-d88899990000",
  createdAt: "2026-11-04T18:00:00+00:00",
};
const originalSecret = process.env.JWT_SECRET;

async function call(payload: unknown, { signedIn = true } = {}) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${groupId}/list-items/${itemId}/complete`,
    {
      method: "POST",
      headers: {
        ...(cookie ? { cookie } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return POST(request, { params: Promise.resolve({ groupId, itemId }) });
}

const evenly = { amountCents: 1234, mode: "even", sharedBy: [userId, samId] };

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

describe("POST /api/groups/{groupId}/list-items/{itemId}/complete (#12)", () => {
  it("checks the item off for the session user with the split fields, and returns it", async () => {
    service.completeListItem.mockResolvedValue(item);

    const response = await call(evenly);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ item });
    expect(service.completeListItem).toHaveBeenCalledWith(
      userId,
      groupId,
      itemId,
      evenly,
    );
  });

  it("is a 400 with the field when the split is missing", async () => {
    const response = await call({ amountCents: 1234 });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.fields).toHaveProperty("mode");
    expect(service.completeListItem).not.toHaveBeenCalled();
  });

  it("is a 400 for a negative cost", async () => {
    const response = await call({ ...evenly, amountCents: -5 });

    expect(response.status).toBe(400);
    expect(service.completeListItem).not.toHaveBeenCalled();
  });

  it("is a 401 without a session", async () => {
    const response = await call(evenly, { signedIn: false });

    expect(response.status).toBe(401);
  });

  it.each([
    [new ValidationError("Check the highlighted fields."), 400],
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new ConflictError("This item is already checked off."), 409],
  ])("passes on the service's %s as %i", async (error, status) => {
    service.completeListItem.mockRejectedValue(error);

    const response = await call(evenly);

    expect(response.status).toBe(status);
  });
});
