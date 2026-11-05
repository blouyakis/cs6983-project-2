// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import { DELETE, PATCH } from "./route";

const service = vi.hoisted(() => ({
  editListItem: vi.fn(),
  removeListItem: vi.fn(),
}));
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
  createdAt: "2026-11-04T18:00:00+00:00",
};
const originalSecret = process.env.JWT_SECRET;

type CallOptions = {
  id?: string;
  payload?: unknown;
  signedIn?: boolean;
};

async function call(
  method: "PATCH" | "DELETE",
  { id = itemId, payload, signedIn = true }: CallOptions = {},
) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${groupId}/list-items/${id}`,
    {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(method === "PATCH" ? { "content-type": "application/json" } : {}),
      },
      body: method === "PATCH" ? JSON.stringify(payload) : undefined,
    },
  );
  const context = { params: Promise.resolve({ groupId, itemId: id }) };
  return method === "PATCH"
    ? PATCH(request, context)
    : DELETE(request, context);
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

describe("PATCH /api/groups/{groupId}/list-items/{itemId}", () => {
  it("edits the item for the session user and returns it", async () => {
    service.editListItem.mockResolvedValue(item);

    const response = await call("PATCH", { payload: { title: "Oat milk" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ item });
    expect(service.editListItem).toHaveBeenCalledWith(userId, groupId, itemId, {
      title: "Oat milk",
    });
  });

  it("is a 400 for an estimate of 0", async () => {
    const response = await call("PATCH", { payload: { estimatedCents: 0 } });

    expect(response.status).toBe(400);
    expect(service.editListItem).not.toHaveBeenCalled();
  });

  it("is a 400 for an item id that isn't a UUID", async () => {
    const response = await call("PATCH", {
      id: "1",
      payload: { title: "Oat milk" },
    });

    expect(response.status).toBe(400);
  });

  it("is a 401 without a session", async () => {
    const response = await call("PATCH", {
      signedIn: false,
      payload: { title: "Oat milk" },
    });

    expect(response.status).toBe(401);
  });

  it.each([
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new ConflictError("Uncheck it first."), 409],
  ])("passes on the service's %s as %i", async (error, status) => {
    service.editListItem.mockRejectedValue(error);

    const response = await call("PATCH", { payload: { title: "Oat milk" } });

    expect(response.status).toBe(status);
  });
});

describe("DELETE /api/groups/{groupId}/list-items/{itemId}", () => {
  it("deletes the item for the session user with 204", async () => {
    service.removeListItem.mockResolvedValue(undefined);

    const response = await call("DELETE");

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(service.removeListItem).toHaveBeenCalledWith(
      userId,
      groupId,
      itemId,
    );
  });

  it("is a 401 without a session", async () => {
    const response = await call("DELETE", { signedIn: false });

    expect(response.status).toBe(401);
  });

  it.each([
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new ConflictError("Uncheck it first."), 409],
  ])("passes on the service's %s as %i", async (error, status) => {
    service.removeListItem.mockRejectedValue(error);

    const response = await call("DELETE");

    expect(response.status).toBe(status);
  });
});
