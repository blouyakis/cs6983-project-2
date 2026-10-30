// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/http/errors";
import { getGroup } from "./group-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./group-access", () => access);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getGroup", () => {
  it("returns the group after checking read access", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: {
        id: groupId,
        name: "Flat",
        isPersonal: false,
        createdBy: userId,
        archivedAt: null,
        createdAt: "2026-10-01T09:00:00+00:00",
      },
      readUntil: null,
    });

    expect(await getGroup(userId, groupId)).toEqual({
      id: groupId,
      name: "Flat",
      isPersonal: false,
      archivedAt: null,
      createdAt: "2026-10-01T09:00:00+00:00",
    });
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      userId,
      groupId,
      "read",
    );
  });

  it("passes on the 403 from the access check", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(getGroup(userId, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
