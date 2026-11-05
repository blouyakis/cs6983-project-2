// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/http/errors";
import { GET, POST } from "./route";

const service = vi.hoisted(() => ({
  addListItem: vi.fn(),
  listGroupListItems: vi.fn(),
}));
vi.mock("@/lib/services/list-item-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const item = {
  id: "1d5a6182-3333-4444-8555-b66677778888",
  groupId,
  title: "Milk",
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
  raw?: string;
};

async function call(
  method: "GET" | "POST",
  { id = groupId, payload, signedIn = true, raw }: CallOptions = {},
) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/list-items`,
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

describe("POST /api/groups/{groupId}/list-items", () => {
  it("adds the item for the session user and returns it with 201", async () => {
    service.addListItem.mockResolvedValue(item);

    const response = await call("POST", {
      payload: { title: "Milk", estimatedCents: 450, addedBy: groupId },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ item });
    expect(service.addListItem).toHaveBeenCalledWith(userId, groupId, {
      title: "Milk",
      quantity: null,
      note: null,
      estimatedCents: 450,
    });
  });

  it.each([
    [{ title: "Milk", quantity: 0 }, "quantity"],
    [{ title: "Milk", estimatedCents: -1 }, "estimatedCents"],
    [{ title: "" }, "title"],
  ])("is a 400 on the field for %j", async (payload, field) => {
    const response = await call("POST", { payload });

    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(error.fields)).toEqual([field]);
    expect(service.addListItem).not.toHaveBeenCalled();
  });

  it("is a 400 for a body that isn't JSON", async () => {
    const response = await call("POST", { raw: "{" });

    expect(response.status).toBe(400);
  });

  it("is a 400 for a group id that isn't a UUID", async () => {
    const response = await call("POST", {
      id: "flat",
      payload: { title: "Milk" },
    });

    expect(response.status).toBe(400);
    expect(service.addListItem).not.toHaveBeenCalled();
  });

  it("is a 401 without a session", async () => {
    const response = await call("POST", {
      signedIn: false,
      payload: { title: "Milk" },
    });

    expect(response.status).toBe(401);
  });

  it("passes on the service's 403", async () => {
    service.addListItem.mockRejectedValue(new ForbiddenError());

    const response = await call("POST", { payload: { title: "Milk" } });

    expect(response.status).toBe(403);
  });
});

describe("GET /api/groups/{groupId}/list-items", () => {
  it("lists the group's items for the session user", async () => {
    service.listGroupListItems.mockResolvedValue([item]);

    const response = await call("GET");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [item] });
    expect(service.listGroupListItems).toHaveBeenCalledWith(userId, groupId);
  });

  it("is a 401 without a session", async () => {
    const response = await call("GET", { signedIn: false });

    expect(response.status).toBe(401);
  });

  it("passes on the service's 403", async () => {
    service.listGroupListItems.mockRejectedValue(new ForbiddenError());

    const response = await call("GET");

    expect(response.status).toBe(403);
  });
});
