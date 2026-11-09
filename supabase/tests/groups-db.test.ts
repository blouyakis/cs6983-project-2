// lib/db functions for groups (#6), against the real database: the joins,
// rejoining with the weight rule (#63), and the Postgres errors they turn into typed errors.
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  addMember,
  listCurrentMembers,
  listCurrentMemberWeights,
  listMembersAt,
  listMemberships,
} from "@/lib/db/group-members";
import { createGroup, updateGroup } from "@/lib/db/groups";
import { ConflictError, ValidationError } from "@/lib/http/errors";
import {
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
  dbNow,
} from "./fixtures";

afterAll(cleanUp);

async function nameUser(userId: string, name: string): Promise<void> {
  const { error } = await db.from("users").update({ name }).eq("id", userId);
  if (error) {
    throw error;
  }
}

// left_at from the database's clock, the one that stamps the next join's
// joined_at, so the two can't tie or cross (#75).
async function leave(groupId: string, userId: string): Promise<void> {
  const { error } = await db
    .from("group_members")
    .update({ left_at: await dbNow() })
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

describe("updateGroup", () => {
  it("renames the group", async () => {
    const { groupId } = await createGroupWithMembers(1);

    await updateGroup(groupId, { name: "Dorm 4B" });

    const group = await db
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();
    expect(group.data?.name).toBe("Dorm 4B");
  });

  it("turns weights that don't list every current member into a ValidationError", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    await expect(
      updateGroup(groupId, {
        memberWeights: [{ userId: memberIds[0], weight: 3 }],
      }),
    ).rejects.toEqual(
      new ValidationError("Check the highlighted fields.", {
        memberWeights: "List a weight for every current member.",
      }),
    );
  });
});

describe("listCurrentMembers", () => {
  it("lists current members with their names and weights, oldest first", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ben, cat] = memberIds;
    await nameUser(ana, "Ana");
    await nameUser(ben, "Ben");
    await leave(groupId, cat);
    await updateGroup(groupId, {
      memberWeights: [
        { userId: ana, weight: 3 },
        { userId: ben, weight: 2 },
      ],
    });

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

describe("listMembersAt", () => {
  it("lists the members as they were at a moment, for a former member", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ben, cat] = memberIds;
    await leave(groupId, cat);
    const catLeftAt = (await membershipRow(groupId, cat)).left_at as string;
    // After Cat left: Dan joins and Ben leaves.
    const dan = await createUser();
    await addMember(groupId, dan);
    await leave(groupId, ben);

    const members = await listMembersAt(groupId, catLeftAt);

    expect(members.map((member) => member.userId).sort()).toEqual(
      [ana, ben, cat].sort(),
    );
  });

  it("leaves out a member who joined 0.4 ms after a former member left (#75)", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, cat] = memberIds;
    // Fixed times in one millisecond, so the test doesn't depend on timing.
    const catLeftAt = "2099-01-01T00:00:00.123456+00:00";
    const { error: leaveError } = await db
      .from("group_members")
      .update({ left_at: catLeftAt })
      .eq("group_id", groupId)
      .eq("user_id", cat);
    if (leaveError) {
      throw leaveError;
    }
    const dan = await createUser();
    const { error: joinError } = await db.from("group_members").insert({
      group_id: groupId,
      user_id: dan,
      default_share_weight: 1,
      joined_at: "2099-01-01T00:00:00.123856+00:00",
    });
    if (joinError) {
      throw joinError;
    }

    const members = await listMembersAt(groupId, catLeftAt);

    expect(members.map((member) => member.userId).sort()).toEqual(
      [ana, cat].sort(),
    );
  });

  it("lists the current members when there is no moment", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await leave(groupId, memberIds[1]);

    const members = await listMembersAt(groupId, null);

    expect(members.map((member) => member.userId)).toEqual([memberIds[0]]);
  });
});

describe("listMemberships", () => {
  it("shows a group the user left with its members as they were when they left", async () => {
    const userId = await createUser();
    const groupId = await createGroup("Cape weekend", userId);
    const ben = await createUser();
    await addMember(groupId, ben);
    await leave(groupId, userId);
    const later = await createUser();
    await addMember(groupId, later);

    const memberships = await listMemberships(userId);

    const left = memberships.find((m) => m.group.id === groupId);
    expect(left?.members.map((member) => member.userId).sort()).toEqual(
      [userId, ben].sort(),
    );
  });

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
    expect(byId.get(left)?.members).toEqual(
      expect.arrayContaining([
        { userId: other, name: "Ben", defaultShareWeight: 1 },
      ]),
    );
  });
});

// Sets every listed member's weight, through the same function as the
// Default split form.
async function setWeights(
  groupId: string,
  weights: Record<string, number>,
): Promise<void> {
  await updateGroup(groupId, {
    memberWeights: Object.entries(weights).map(([userId, weight]) => ({
      userId,
      weight,
    })),
  });
}

async function weightsOf(groupId: string): Promise<number[]> {
  return (await listCurrentMemberWeights(groupId)).map(
    (sharer) => sharer.weight,
  );
}

// One function for a new member and a former one, so both follow the same
// weight rule in the same transaction as the join (#63).
describe("addMember", () => {
  it("adds a new member at weight 1 to an even group, without a reset", async () => {
    const { groupId } = await createGroupWithMembers(1);
    const newcomer = await createUser();

    expect(await addMember(groupId, newcomer)).toEqual({
      weight: 1,
      splitReset: false,
    });

    expect(await membershipRow(groupId, newcomer)).toMatchObject({
      default_share_weight: 1,
      left_at: null,
    });
  });

  it("gives the newcomer the weight every member shares: 50 and 50 plus Jo is 50, 50 and 50", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await setWeights(groupId, { [memberIds[0]]: 50, [memberIds[1]]: 50 });
    const jo = await createUser();

    expect(await addMember(groupId, jo)).toEqual({
      weight: 50,
      splitReset: false,
    });

    expect(await weightsOf(groupId)).toEqual([50, 50, 50]);
  });

  it("resets an uneven group to weight 1: 60 and 40 plus Jo is 1, 1 and 1", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await setWeights(groupId, { [memberIds[0]]: 60, [memberIds[1]]: 40 });
    const jo = await createUser();

    expect(await addMember(groupId, jo)).toEqual({
      weight: 1,
      splitReset: true,
    });

    expect(await weightsOf(groupId)).toEqual([1, 1, 1]);
  });

  it("leaves a former member's weight out of the rule", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ben, cal] = memberIds;
    await setWeights(groupId, { [ana]: 60, [ben]: 40, [cal]: 40 });
    await leave(groupId, ana);
    const jo = await createUser();

    expect(await addMember(groupId, jo)).toEqual({
      weight: 40,
      splitReset: false,
    });
    expect(await weightsOf(groupId)).toEqual([40, 40, 40]);
    expect((await membershipRow(groupId, ana)).default_share_weight).toBe(60);
  });

  it("makes a former member current again, from now", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [, ben] = memberIds;
    await leave(groupId, ben);
    const before = await membershipRow(groupId, ben);

    expect(await addMember(groupId, ben)).toEqual({
      weight: 1,
      splitReset: false,
    });

    const after = await membershipRow(groupId, ben);
    expect(after.left_at).toBeNull();
    expect(after.default_share_weight).toBe(1);
    expect(new Date(after.joined_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.left_at!).getTime(),
    );
  });

  it("resets a 60/40 group when a former member rejoins it", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ben, cal] = memberIds;
    await leave(groupId, cal);
    await setWeights(groupId, { [ana]: 60, [ben]: 40 });

    expect(await addMember(groupId, cal)).toEqual({
      weight: 1,
      splitReset: true,
    });

    expect(await weightsOf(groupId)).toEqual([1, 1, 1]);
  });

  it("gives a former member who rejoins an even group the weight it shares, not their old one", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ben, cal] = memberIds;
    await setWeights(groupId, { [ana]: 20, [ben]: 20, [cal]: 70 });
    await leave(groupId, cal);

    expect(await addMember(groupId, cal)).toEqual({
      weight: 20,
      splitReset: false,
    });
    expect(await weightsOf(groupId)).toEqual([20, 20, 20]);
  });

  describe("with this machine's clock wrong", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("takes joined_at from the database's clock for a new member", async () => {
      const { groupId } = await createGroupWithMembers(1);
      const newcomer = await createUser();
      const start = await dbNow();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2000-01-01T00:00:00Z"));

      await addMember(groupId, newcomer);

      vi.useRealTimers();
      const end = await dbNow();
      const joinedAt = Date.parse(
        (await membershipRow(groupId, newcomer)).joined_at,
      );
      expect(joinedAt).toBeGreaterThanOrEqual(Date.parse(start));
      expect(joinedAt).toBeLessThanOrEqual(Date.parse(end));
    });

    it("takes joined_at from the database's clock for a former member (#75)", async () => {
      const { groupId, memberIds } = await createGroupWithMembers(2);
      const [, ben] = memberIds;
      await leave(groupId, ben);
      const start = await dbNow();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2000-01-01T00:00:00Z"));

      await addMember(groupId, ben);

      vi.useRealTimers();
      const end = await dbNow();
      const joinedAt = Date.parse(
        (await membershipRow(groupId, ben)).joined_at,
      );
      expect(joinedAt).toBeGreaterThanOrEqual(Date.parse(start));
      expect(joinedAt).toBeLessThanOrEqual(Date.parse(end));
    });
  });

  it("turns a 13th current member into a ConflictError and changes no weight", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(12);
    await setWeights(
      groupId,
      Object.fromEntries(memberIds.map((id, index) => [id, index + 1])),
    );
    const newcomer = await createUser();

    await expect(addMember(groupId, newcomer)).rejects.toEqual(
      new ConflictError("A group can have at most 12 members."),
    );
    expect(await weightsOf(groupId)).toEqual(
      memberIds.map((_, index) => index + 1),
    );
  });

  it("turns a former member rejoining a full group into a ConflictError and changes no weight", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(12);
    await leave(groupId, memberIds[11]);
    await addMember(groupId, await createUser());
    const current = (await listCurrentMemberWeights(groupId)).map(
      (sharer) => sharer.userId,
    );
    await setWeights(
      groupId,
      Object.fromEntries(current.map((id, index) => [id, index + 1])),
    );

    await expect(addMember(groupId, memberIds[11])).rejects.toEqual(
      new ConflictError("A group can have at most 12 members."),
    );
    expect(await weightsOf(groupId)).toEqual(
      current.map((_, index) => index + 1),
    );
  });

  it("turns a current member into a ConflictError and changes no weight", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await setWeights(groupId, { [memberIds[0]]: 60, [memberIds[1]]: 40 });

    await expect(addMember(groupId, memberIds[0])).rejects.toEqual(
      new ConflictError("They are already in this group."),
    );
    expect(await weightsOf(groupId)).toEqual([60, 40]);
  });
});
