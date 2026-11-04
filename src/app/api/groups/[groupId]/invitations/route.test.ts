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

const service = vi.hoisted(() => ({ inviteMember: vi.fn() }));
vi.mock("@/lib/services/group-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const sam = {
  userId: "7a2d3e5f-1111-4222-8333-944455556666",
  name: "Sam",
  defaultShareWeight: 1,
};
const originalSecret = process.env.JWT_SECRET;

async function invite(body: unknown, id = groupId, signedIn = true) {
  const cookie = signedIn ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(
    `http://localhost/api/groups/${id}/invitations`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  return POST(request, { params: Promise.resolve({ groupId: id }) });
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

describe("POST /api/groups/{groupId}/invitations", () => {
  it("adds the member and returns 201, with the email lowercased", async () => {
    service.inviteMember.mockResolvedValue(sam);

    const response = await invite({ email: " Sam@Example.COM " });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ member: sam });
    expect(service.inviteMember).toHaveBeenCalledWith(userId, groupId, {
      email: "sam@example.com",
    });
  });

  it("returns 400 for something that is not an email, without asking the service", async () => {
    const response = await invite({ email: "sam" });

    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      email: "Enter a valid email address.",
    });
    expect(service.inviteMember).not.toHaveBeenCalled();
  });

  it("returns 400 for a group id that is not a UUID", async () => {
    const response = await invite({ email: "sam@example.com" }, "nope");

    expect(response.status).toBe(400);
    expect(service.inviteMember).not.toHaveBeenCalled();
  });

  it.each([
    [new NotFoundError("No LifeBoard account uses that email."), 404],
    [new ConflictError("They are already in this group."), 409],
    [new ConflictError("A group can have at most 12 members."), 409],
    [new ForbiddenError("A personal space can't have other members."), 403],
  ])("passes on %s as %i", async (error, status) => {
    service.inviteMember.mockRejectedValue(error);

    const response = await invite({ email: "sam@example.com" });

    expect(response.status).toBe(status);
    expect((await response.json()).error.message).toBe(error.message);
  });

  it("returns 401 without a session", async () => {
    const response = await invite({ email: "sam@example.com" }, groupId, false);

    expect(response.status).toBe(401);
    expect(service.inviteMember).not.toHaveBeenCalled();
  });
});
