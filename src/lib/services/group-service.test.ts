// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, Member, Membership } from "@/lib/db/group-members";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import {
  createGroup,
  getGroup,
  inviteMember,
  listGroups,
  updateGroup,
} from "./group-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const members = vi.hoisted(() => ({
  addMember: vi.fn(),
  findMembership: vi.fn(),
  listCurrentMembers: vi.fn(),
  listMembersAt: vi.fn(),
  listMemberships: vi.fn(),
  rejoinMember: vi.fn(),
}));
vi.mock("@/lib/db/group-members", () => members);

const groups = vi.hoisted(() => ({
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
}));
vi.mock("@/lib/db/groups", () => groups);

const users = vi.hoisted(() => ({ findUserByEmail: vi.fn() }));
vi.mock("@/lib/db/users", () => users);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

function group(overrides: Partial<Group> = {}): Group {
  return {
    id: groupId,
    name: "Flat",
    isPersonal: false,
    createdBy: userId,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    ...overrides,
  };
}

const ana: Member = { userId, name: "Ana", defaultShareWeight: 1 };
const sam: Member = { userId: samId, name: "Sam", defaultShareWeight: 1 };

function grantAccess(overrides: Partial<Group> = {}) {
  access.requireGroupAccess.mockResolvedValue({
    group: group(overrides),
    readUntil: null,
  });
}

function samAccount() {
  return {
    id: samId,
    email: "sam@example.com",
    name: "Sam",
    passwordHash: "hash",
    createdAt: "2026-10-01T09:00:00+00:00",
    updatedAt: "2026-10-01T09:00:00+00:00",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getGroup", () => {
  it("returns the group and its current members after checking read access", async () => {
    grantAccess();
    members.listMembersAt.mockResolvedValue([ana, sam]);

    expect(await getGroup(userId, groupId)).toEqual({
      id: groupId,
      name: "Flat",
      isPersonal: false,
      archivedAt: null,
      createdAt: "2026-10-01T09:00:00+00:00",
      readOnly: false,
      members: [ana, sam],
    });
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      userId,
      groupId,
      "read",
    );
    expect(members.listMembersAt).toHaveBeenCalledWith(groupId, null);
  });

  it("passes on the 403 from the access check", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(getGroup(userId, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("is read-only for a former member", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: group(),
      readUntil: "2026-10-20T09:00:00+00:00",
    });
    members.listMembersAt.mockResolvedValue([sam]);

    expect((await getGroup(userId, groupId)).readOnly).toBe(true);
  });

  // AGENTS.md 6.6: a former member reads nothing created after they left,
  // so the member list stops at that moment too.
  it("shows a former member the members as they were when they left", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: group(),
      readUntil: "2026-10-20T09:00:00+00:00",
    });
    members.listMembersAt.mockResolvedValue([ana, sam]);

    expect((await getGroup(userId, groupId)).members).toEqual([ana, sam]);
    expect(members.listMembersAt).toHaveBeenCalledWith(
      groupId,
      "2026-10-20T09:00:00+00:00",
    );
  });

  it("is read-only once the group is archived", async () => {
    grantAccess({ archivedAt: "2026-10-20T09:00:00+00:00" });
    members.listMembersAt.mockResolvedValue([]);

    expect((await getGroup(userId, groupId)).readOnly).toBe(true);
  });
});

describe("createGroup", () => {
  it("creates the group with the session user as creator and returns it", async () => {
    groups.createGroup.mockResolvedValue(groupId);
    grantAccess({ name: "🏠 Flat" });
    members.listMembersAt.mockResolvedValue([ana]);

    const created = await createGroup(userId, { name: "🏠 Flat" });

    expect(groups.createGroup).toHaveBeenCalledWith("🏠 Flat", userId);
    expect(created).toMatchObject({ id: groupId, name: "🏠 Flat" });
    expect(created.members).toEqual([ana]);
  });
});

describe("listGroups", () => {
  function membership(
    overrides: Partial<Group>,
    leftAt: string | null = null,
  ): Membership & { members: Member[] } {
    return {
      group: group(overrides),
      joinedAt: "2026-10-01T09:00:00+00:00",
      leftAt,
      members: [ana],
    };
  }

  it("lists the personal space first, then active groups, then read-only ones", async () => {
    members.listMemberships.mockResolvedValue([
      membership({ id: "left", name: "Cape weekend" }, "2026-09-02T10:00:00Z"),
      membership({ id: "flat", name: "Flat" }),
      membership({
        id: "archived",
        name: "Old flat",
        archivedAt: "2026-08-01T10:00:00Z",
      }),
      membership({ id: "personal", name: "Personal space", isPersonal: true }),
    ]);

    const list = await listGroups(userId);

    expect(members.listMemberships).toHaveBeenCalledWith(userId);
    expect(list.map((g) => g.id)).toEqual([
      "personal",
      "flat",
      "left",
      "archived",
    ]);
  });

  it("marks groups the user left or that were archived as read-only", async () => {
    members.listMemberships.mockResolvedValue([
      membership({ id: "flat" }),
      membership({ id: "left" }, "2026-09-02T10:00:00Z"),
      membership({ id: "archived", archivedAt: "2026-08-01T10:00:00Z" }),
    ]);

    const list = await listGroups(userId);

    expect(list).toEqual([
      expect.objectContaining({ id: "flat", readOnly: false, leftAt: null }),
      expect.objectContaining({
        id: "left",
        readOnly: true,
        leftAt: "2026-09-02T10:00:00Z",
      }),
      expect.objectContaining({ id: "archived", readOnly: true }),
    ]);
  });

  it("does not return who created each group", async () => {
    members.listMemberships.mockResolvedValue([membership({})]);

    const [first] = await listGroups(userId);

    expect(first).not.toHaveProperty("createdBy");
    expect(first.members).toEqual([ana]);
  });
});

describe("inviteMember", () => {
  it("adds an account that has never been in the group", async () => {
    grantAccess();
    users.findUserByEmail.mockResolvedValue(samAccount());
    members.findMembership.mockResolvedValue(null);

    const added = await inviteMember(userId, groupId, {
      email: "sam@example.com",
    });

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      userId,
      groupId,
      "write",
    );
    expect(users.findUserByEmail).toHaveBeenCalledWith("sam@example.com");
    expect(members.addMember).toHaveBeenCalledWith(groupId, samId);
    expect(added).toEqual(sam);
  });

  it("lets a former member rejoin", async () => {
    grantAccess();
    users.findUserByEmail.mockResolvedValue(samAccount());
    members.findMembership.mockResolvedValue({
      group: group(),
      joinedAt: "2026-10-01T09:00:00+00:00",
      leftAt: "2026-10-20T09:00:00+00:00",
    });

    expect(
      await inviteMember(userId, groupId, { email: "sam@example.com" }),
    ).toEqual(sam);
    expect(members.rejoinMember).toHaveBeenCalledWith(groupId, samId);
    expect(members.addMember).not.toHaveBeenCalled();
  });

  it("rejects someone who is already a current member with 409", async () => {
    grantAccess();
    users.findUserByEmail.mockResolvedValue(samAccount());
    members.findMembership.mockResolvedValue({
      group: group(),
      joinedAt: "2026-10-01T09:00:00+00:00",
      leftAt: null,
    });

    await expect(
      inviteMember(userId, groupId, { email: "sam@example.com" }),
    ).rejects.toEqual(new ConflictError("They are already in this group."));
    expect(members.addMember).not.toHaveBeenCalled();
  });

  it("rejects an email with no account with 404", async () => {
    grantAccess();
    users.findUserByEmail.mockResolvedValue(null);

    await expect(
      inviteMember(userId, groupId, { email: "nobody@example.com" }),
    ).rejects.toEqual(
      new NotFoundError("No LifeBoard account uses that email."),
    );
  });

  it("rejects an invitation to a personal space with 403, before looking anyone up", async () => {
    grantAccess({ isPersonal: true });

    await expect(
      inviteMember(userId, groupId, { email: "sam@example.com" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(users.findUserByEmail).not.toHaveBeenCalled();
  });

  it("passes on the 403 for a former member or an archived group", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(
      inviteMember(userId, groupId, { email: "sam@example.com" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(users.findUserByEmail).not.toHaveBeenCalled();
  });

  it("passes on the 409 when the group is full", async () => {
    grantAccess();
    users.findUserByEmail.mockResolvedValue(samAccount());
    members.findMembership.mockResolvedValue(null);
    members.addMember.mockRejectedValue(
      new ConflictError("A group can have at most 12 members."),
    );

    await expect(
      inviteMember(userId, groupId, { email: "sam@example.com" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("updateGroup", () => {
  beforeEach(() => {
    members.listCurrentMembers.mockResolvedValue([ana, sam]);
  });

  it("renames the group after checking write access", async () => {
    grantAccess();

    await updateGroup(userId, groupId, { name: "Dorm 4B" });

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      userId,
      groupId,
      "write",
    );
    expect(groups.updateGroup).toHaveBeenCalledWith(groupId, {
      name: "Dorm 4B",
    });
  });

  it("passes new weights to the database, which checks them in one transaction", async () => {
    grantAccess();
    const memberWeights = [
      { userId: samId, weight: 2 },
      { userId, weight: 3 },
    ];

    await updateGroup(userId, groupId, { memberWeights });

    expect(groups.updateGroup).toHaveBeenCalledWith(groupId, {
      memberWeights,
    });
  });

  it("returns the group with its new name and members, checking access only once", async () => {
    grantAccess();

    const updated = await updateGroup(userId, groupId, { name: "Dorm 4B" });

    expect(updated).toMatchObject({
      id: groupId,
      name: "Dorm 4B",
      readOnly: false,
      members: [ana, sam],
    });
    expect(access.requireGroupAccess).toHaveBeenCalledTimes(1);
    expect(members.listCurrentMembers).toHaveBeenCalledTimes(1);
  });

  it("passes on the 400 for weights that don't list every current member", async () => {
    grantAccess();
    const invalid = new ValidationError("Check the highlighted fields.", {
      memberWeights: "List a weight for every current member.",
    });
    groups.updateGroup.mockRejectedValue(invalid);

    await expect(
      updateGroup(userId, groupId, {
        memberWeights: [{ userId, weight: 3 }],
      }),
    ).rejects.toBe(invalid);
  });

  it("passes on the 403 for a former member or an archived group", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(
      updateGroup(userId, groupId, { name: "Dorm 4B" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(groups.updateGroup).not.toHaveBeenCalled();
  });
});
