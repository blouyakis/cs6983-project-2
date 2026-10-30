// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Membership } from "@/lib/db/group-members";
import { ForbiddenError } from "@/lib/http/errors";
import { requireGroupAccess } from "./group-access";

const db = vi.hoisted(() => ({ findMembership: vi.fn() }));
vi.mock("@/lib/db/group-members", () => db);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const otherId = "9a8b7c6d-3333-4444-8555-666677778888";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

function membership(overrides: {
  leftAt?: string | null;
  archivedAt?: string | null;
  isPersonal?: boolean;
  createdBy?: string;
}): Membership {
  return {
    joinedAt: "2026-10-01T09:00:00+00:00",
    leftAt: overrides.leftAt ?? null,
    group: {
      id: groupId,
      name: "Flat",
      isPersonal: overrides.isPersonal ?? false,
      createdBy: overrides.createdBy ?? otherId,
      archivedAt: overrides.archivedAt ?? null,
      createdAt: "2026-10-01T09:00:00+00:00",
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("requireGroupAccess", () => {
  it.each(["read", "write"] as const)(
    "lets a current member %s an active group",
    async (mode) => {
      db.findMembership.mockResolvedValue(membership({}));

      const access = await requireGroupAccess(userId, groupId, mode);

      expect(access.group.id).toBe(groupId);
      expect(access.readUntil).toBeNull();
      expect(db.findMembership).toHaveBeenCalledWith(userId, groupId);
    },
  );

  it.each(["read", "write"] as const)(
    "gives someone who was never a member 403 to %s",
    async (mode) => {
      db.findMembership.mockResolvedValue(null);

      await expect(
        requireGroupAccess(userId, groupId, mode),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("lets a current member read an archived group", async () => {
    db.findMembership.mockResolvedValue(
      membership({ archivedAt: "2026-10-20T09:00:00+00:00" }),
    );

    const access = await requireGroupAccess(userId, groupId, "read");

    expect(access.group.archivedAt).toBe("2026-10-20T09:00:00+00:00");
    expect(access.readUntil).toBeNull();
  });

  it("gives a current member 403 to write an archived group", async () => {
    db.findMembership.mockResolvedValue(
      membership({ archivedAt: "2026-10-20T09:00:00+00:00" }),
    );

    await expect(requireGroupAccess(userId, groupId, "write")).rejects.toThrow(
      "This group is archived and read-only.",
    );
  });

  it("lets a former member read, only up to the day they left", async () => {
    db.findMembership.mockResolvedValue(
      membership({ leftAt: "2026-10-15T09:00:00+00:00" }),
    );

    const access = await requireGroupAccess(userId, groupId, "read");

    expect(access.readUntil).toBe("2026-10-15T09:00:00+00:00");
  });

  it("gives a former member 403 to write", async () => {
    db.findMembership.mockResolvedValue(
      membership({ leftAt: "2026-10-15T09:00:00+00:00" }),
    );

    await expect(requireGroupAccess(userId, groupId, "write")).rejects.toThrow(
      "You left this group, so you can only read its history.",
    );
  });

  it("lets the owner use their personal space", async () => {
    db.findMembership.mockResolvedValue(
      membership({ isPersonal: true, createdBy: userId }),
    );

    const access = await requireGroupAccess(userId, groupId, "write");

    expect(access.group.isPersonal).toBe(true);
  });

  it.each(["read", "write"] as const)(
    "gives anyone but the owner 403 to %s a personal space",
    async (mode) => {
      db.findMembership.mockResolvedValue(
        membership({ isPersonal: true, createdBy: otherId }),
      );

      await expect(
        requireGroupAccess(userId, groupId, mode),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("does not say whether a group exists", async () => {
    db.findMembership.mockResolvedValue(null);

    await expect(requireGroupAccess(userId, groupId, "read")).rejects.toThrow(
      "You are not a member of this group.",
    );
  });
});
