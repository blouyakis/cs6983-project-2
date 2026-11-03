import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

async function weightsOf(groupId: string): Promise<Record<string, number>> {
  const { data, error } = await db
    .from("group_members")
    .select("user_id, default_share_weight")
    .eq("group_id", groupId);
  if (error) {
    throw error;
  }
  return Object.fromEntries(
    data.map((row) => [row.user_id, row.default_share_weight]),
  );
}

describe("create_group", () => {
  it("creates a shared group whose creator is its only member, at weight 1", async () => {
    const userId = await createUser();

    const { data: groupId, error } = await db.rpc("create_group", {
      p_name: "🏠 Flat",
      p_created_by: userId,
    });

    expect(error).toBeNull();
    const group = await db
      .from("groups")
      .select("name, is_personal, created_by, archived_at")
      .eq("id", groupId)
      .single();
    expect(group.data).toEqual({
      name: "🏠 Flat",
      is_personal: false,
      created_by: userId,
      archived_at: null,
    });
    const members = await db
      .from("group_members")
      .select("user_id, default_share_weight, left_at")
      .eq("group_id", groupId);
    expect(members.data).toEqual([
      { user_id: userId, default_share_weight: 1, left_at: null },
    ]);
  });

  it("leaves no group behind when the creator does not exist", async () => {
    const name = `Ghost ${randomUUID()}`;

    const { error } = await db.rpc("create_group", {
      p_name: name,
      p_created_by: randomUUID(),
    });

    expect(error?.code).toBe("23503");
    const groups = await db.from("groups").select("id").eq("name", name);
    expect(groups.data).toEqual([]);
  });

  it("cannot be called with the anon key", async () => {
    const userId = await createUser();

    const { error } = await anonDb().rpc("create_group", {
      p_name: "Flat",
      p_created_by: userId,
    });

    expect(error?.code).toBe("42501");
  });
});

describe("set_member_weights", () => {
  it("sets every listed member's weight in one call", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, ben] = memberIds;

    const { error } = await db.rpc("set_member_weights", {
      p_group_id: groupId,
      p_weights: [
        { user_id: ana, weight: 3 },
        { user_id: ben, weight: 2 },
      ],
    });

    expect(error).toBeNull();
    expect(await weightsOf(groupId)).toEqual({ [ana]: 3, [ben]: 2 });
  });

  it("changes nothing when one weight is 0", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, ben] = memberIds;

    const { error } = await db.rpc("set_member_weights", {
      p_group_id: groupId,
      p_weights: [
        { user_id: ana, weight: 3 },
        { user_id: ben, weight: 0 },
      ],
    });

    expect(error?.code).toBe("23514");
    expect(await weightsOf(groupId)).toEqual({ [ana]: 1, [ben]: 1 });
  });

  it("changes nothing when a listed user is not a current member", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, ben] = memberIds;
    const outsider = await createUser();

    const { error } = await db.rpc("set_member_weights", {
      p_group_id: groupId,
      p_weights: [
        { user_id: ana, weight: 3 },
        { user_id: outsider, weight: 2 },
      ],
    });

    expect(error?.code).toBe("P0002");
    expect(await weightsOf(groupId)).toEqual({ [ana]: 1, [ben]: 1 });
  });

  it("cannot be called with the anon key", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await anonDb().rpc("set_member_weights", {
      p_group_id: groupId,
      p_weights: [{ user_id: memberIds[0], weight: 2 }],
    });

    expect(error?.code).toBe("42501");
  });
});

describe("default_share_weight", () => {
  it("accepts 100", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db
      .from("group_members")
      .update({ default_share_weight: 100 })
      .eq("group_id", groupId)
      .eq("user_id", memberIds[0]);

    expect(error).toBeNull();
  });

  it("rejects more than 100, so splitting stays within safe integers", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db
      .from("group_members")
      .update({ default_share_weight: 101 })
      .eq("group_id", groupId)
      .eq("user_id", memberIds[0]);

    expect(error?.code).toBe("23514");
  });
});
