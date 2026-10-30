import { afterAll, describe, expect, it } from "vitest";
import { cleanUp, createUser, db } from "./fixtures";

afterAll(cleanUp);

const MAX_GROUP_MEMBERS = 12;

function membership(groupId: string, userId: string) {
  return { group_id: groupId, user_id: userId, default_share_weight: 1 };
}

async function createUsers(count: number): Promise<string[]> {
  return Promise.all(Array.from({ length: count }, () => createUser()));
}

// A group whose first `count` users are current members.
async function groupWithMembers(count: number) {
  const [ownerId, ...others] = await createUsers(count);
  const group = await db
    .from("groups")
    .insert({ name: "Flat", created_by: ownerId })
    .select("id")
    .single();
  const groupId = group.data!.id as string;
  const memberIds = [ownerId, ...others];
  const { error } = await db
    .from("group_members")
    .insert(memberIds.map((id) => membership(groupId, id)));
  if (error) {
    throw error;
  }
  return { groupId, memberIds };
}

describe("group member cap", () => {
  it("accepts the 12th current member", async () => {
    const { groupId } = await groupWithMembers(MAX_GROUP_MEMBERS - 1);
    const [newcomer] = await createUsers(1);

    const { error } = await db
      .from("group_members")
      .insert(membership(groupId, newcomer));

    expect(error).toBeNull();
  });

  it("rejects a 13th current member", async () => {
    const { groupId } = await groupWithMembers(MAX_GROUP_MEMBERS);
    const [newcomer] = await createUsers(1);

    const { error } = await db
      .from("group_members")
      .insert(membership(groupId, newcomer));

    expect(error?.code).toBe("23514");
    expect(error?.message).toBe("A group can have at most 12 current members.");
  });

  it("rejects one insert that would add a 13th member", async () => {
    const [ownerId] = await createUsers(1);
    const group = await db
      .from("groups")
      .insert({ name: "Flat", created_by: ownerId })
      .select("id")
      .single();
    const others = await createUsers(MAX_GROUP_MEMBERS);

    const { error } = await db
      .from("group_members")
      .insert([ownerId, ...others].map((id) => membership(group.data!.id, id)));

    expect(error?.code).toBe("23514");
  });

  it("does not count members who left", async () => {
    const { groupId, memberIds } = await groupWithMembers(MAX_GROUP_MEMBERS);
    await db
      .from("group_members")
      .update({ left_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .eq("user_id", memberIds[1]);
    const [newcomer] = await createUsers(1);

    const { error } = await db
      .from("group_members")
      .insert(membership(groupId, newcomer));

    expect(error).toBeNull();
  });

  it("checks the cap when a former member rejoins", async () => {
    const { groupId } = await groupWithMembers(MAX_GROUP_MEMBERS);
    const [formerId] = await createUsers(1);
    await db.from("group_members").insert({
      ...membership(groupId, formerId),
      joined_at: "2026-10-01T00:00:00Z",
      left_at: "2026-10-02T00:00:00Z",
    });

    const { error } = await db
      .from("group_members")
      .update({ left_at: null })
      .eq("group_id", groupId)
      .eq("user_id", formerId);

    expect(error?.code).toBe("23514");
  });

  it("lets members of a full group change their share weight", async () => {
    const { groupId, memberIds } = await groupWithMembers(MAX_GROUP_MEMBERS);

    const { error } = await db
      .from("group_members")
      .update({ default_share_weight: 2 })
      .eq("group_id", groupId)
      .eq("user_id", memberIds[0]);

    expect(error).toBeNull();
  });

  it("gives the last place to only one of two concurrent joins", async () => {
    const { groupId } = await groupWithMembers(MAX_GROUP_MEMBERS - 1);
    const [first, second] = await createUsers(2);

    const results = await Promise.all([
      db.from("group_members").insert(membership(groupId, first)),
      db.from("group_members").insert(membership(groupId, second)),
    ]);

    const errors = results.map((result) => result.error?.code ?? null);
    expect(errors.sort()).toEqual(["23514", null]);
  });
});
