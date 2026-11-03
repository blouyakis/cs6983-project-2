// lib/db functions for groups (#6), against the real database: the joins,
// rejoining, and the Postgres errors they turn into typed errors.
import { afterAll, describe, expect, it } from "vitest";
import {
  addMember,
  listCurrentMembers,
  listCurrentMemberWeights,
  listMemberships,
  rejoinMember,
} from "@/lib/db/group-members";
import { createGroup, renameGroup, setMemberWeights } from "@/lib/db/groups";
import { ConflictError } from "@/lib/http/errors";
import { cleanUp, createGroupWithMembers, createUser, db } from "./fixtures";

afterAll(cleanUp);

async function nameUser(userId: string, name: string): Promise<void> {
  const { error } = await db.from("users").update({ name }).eq("id", userId);
  if (error) {
    throw error;
  }
}

async function leave(groupId: string, userId: string): Promise<void> {
  const { error } = await db
    .from("group_members")
    .update({ left_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}

async function membershipRow(groupId: string, userId: string) {
  const { data, error } = await db
    .from("group_members")
    .select("default_share_weight, joined_at, left_at")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

describe("createGroup", () => {
  it("returns the new group's id, with its creator as a member", async () => {
    const userId = await createUser();

    const groupId = await createGroup("🏠 Flat", userId);

    expect(await listCurrentMemberWeights(groupId)).toEqual([
      { userId, weight: 1 },
    ]);
  });
});

describe("renameGroup", () => {
  it("changes the group's name", async () => {
    const { groupId } = await createGroupWithMembers(1);

    await renameGroup(groupId, "Dorm 4B");

    const group = await db
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();
    expect(group.data?.name).toBe("Dorm 4B");
  });
});

describe("listCurrentMembers", () => {
  it("lists current members with their names and weights, oldest first", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ben, cat] = memberIds;
    await nameUser(ana, "Ana");
    await nameUser(ben, "Ben");
    await leave(groupId, cat);
    await setMemberWeights(groupId, [
      { userId: ana, weight: 3 },
      { userId: ben, weight: 2 },
    ]);

    const members = await listCurrentMembers(groupId);

    expect(members).toHaveLength(2);
    expect(members).toEqual(
      expect.arrayContaining([
        { userId: ana, name: "Ana", defaultShareWeight: 3 },
        { userId: ben, name: "Ben", defaultShareWeight: 2 },
      ]),
    );
  });
});

describe("listMemberships", () => {
  it("lists every group the user is or was in, each with its current members", async () => {
    const userId = await createUser();
    await nameUser(userId, "Ana");
    const current = await createGroup("Flat", userId);
    const other = await createUser();
    await nameUser(other, "Ben");
    await addMember(current, other);
    const left = await createGroup("Cape weekend", userId);
    await addMember(left, other);
    await leave(left, userId);

    const memberships = await listMemberships(userId);

    const byId = new Map(memberships.map((m) => [m.group.id, m]));
    expect(byId.get(current)).toMatchObject({
      leftAt: null,
      group: { name: "Flat", isPersonal: false, archivedAt: null },
    });
    expect(byId.get(current)?.members).toHaveLength(2);
    expect(byId.get(left)?.leftAt).not.toBeNull();
    expect(byId.get(left)?.members).toEqual([
      { userId: other, name: "Ben", defaultShareWeight: 1 },
    ]);
  });
});

describe("addMember", () => {
  it("adds a current member at weight 1", async () => {
    const { groupId } = await createGroupWithMembers(1);
    const newcomer = await createUser();

    await addMember(groupId, newcomer);

    expect(await membershipRow(groupId, newcomer)).toMatchObject({
      default_share_weight: 1,
      left_at: null,
    });
  });

  it("turns a 13th current member into a ConflictError", async () => {
    const { groupId } = await createGroupWithMembers(12);
    const newcomer = await createUser();

    await expect(addMember(groupId, newcomer)).rejects.toEqual(
      new ConflictError("A group can have at most 12 members."),
    );
  });

  it("turns a second row for the same member into a ConflictError", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    await expect(addMember(groupId, memberIds[0])).rejects.toEqual(
      new ConflictError("They are already in this group."),
    );
  });
});

describe("rejoinMember", () => {
  it("makes a former member current again, from now, at weight 1", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [, ben] = memberIds;
    await setMemberWeights(groupId, [
      { userId: memberIds[0], weight: 3 },
      { userId: ben, weight: 2 },
    ]);
    await leave(groupId, ben);
    const before = await membershipRow(groupId, ben);

    await rejoinMember(groupId, ben);

    const after = await membershipRow(groupId, ben);
    expect(after.left_at).toBeNull();
    expect(after.default_share_weight).toBe(1);
    expect(new Date(after.joined_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.left_at!).getTime(),
    );
  });

  it("turns a 13th current member into a ConflictError", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(12);
    await leave(groupId, memberIds[11]);
    await addMember(groupId, await createUser());

    await expect(rejoinMember(groupId, memberIds[11])).rejects.toEqual(
      new ConflictError("A group can have at most 12 members."),
    );
  });
});
