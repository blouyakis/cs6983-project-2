// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import { POST } from "./route";

const service = vi.hoisted(() => ({ reopenListItem: vi.fn() }));
vi.mock("@/lib/services/list-item-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const itemId = "1d5a6182-3333-4444-8555-b66677778888";
const item = {
  id: itemId,
  groupId,
  title: "Oat milk",
  quantity: null,
  note: null,
  estimatedCents: 450,
  status: "open",
  addedBy: userId,
  completedBy: null,
  completedAt: null,
  expenseId: null,
  createdAt: "2026-11-04T18:00:00+00:00",
};
const originalSecret = process.env.JWT_SECRET;

async function call({ id = itemId, signedIn = true } = {}) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${groupId}/list-items/${id}/reopen`,
    { method: "POST", headers: cookie ? { cookie } : {} },
  );
  return POST(request, { params: Promise.resolve({ groupId, itemId: id }) });
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

describe("POST /api/groups/{groupId}/list-items/{itemId}/reopen (#12)", () => {
  it("unchecks the item for the session user and returns it", async () => {
    service.reopenListItem.mockResolvedValue(item);

    const response = await call();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ item });
    expect(service.reopenListItem).toHaveBeenCalledWith(
      userId,
      groupId,
      itemId,
    );
  });

  it("is a 400 for an item id that isn't a UUID", async () => {
    const response = await call({ id: "1" });

    expect(response.status).toBe(400);
    expect(service.reopenListItem).not.toHaveBeenCalled();
  });

  it("is a 401 without a session", async () => {
    const response = await call({ signedIn: false });

    expect(response.status).toBe(401);
  });

  it.each([
    [
      new ForbiddenError("Only the member who checked it off can uncheck it."),
      403,
    ],
    [new NotFoundError(), 404],
    [new ConflictError("A settled expense can't be deleted."), 409],
  ])("passes on the service's %s as %i", async (error, status) => {
    service.reopenListItem.mockRejectedValue(error);

    const response = await call();

    expect(response.status).toBe(status);
  });
});
