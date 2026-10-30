import { afterAll, describe, expect, it } from "vitest";
import { anonDb, cleanUp, createUser, db } from "./fixtures";

afterAll(cleanUp);

async function createGroup(userId: string, isPersonal = false) {
  return db
    .from("groups")
    .insert({ name: "Flat", is_personal: isPersonal, created_by: userId })
    .select("id")
    .single();
}

describe("groups table", () => {
  it("allows one personal space per user", async () => {
    const userId = await createUser();

    const first = await createGroup(userId, true);
    const second = await createGroup(userId, true);

    expect(first.error).toBeNull();
    expect(second.error?.code).toBe("23505");
    expect(second.error?.message).toContain(
      "groups_one_personal_space_per_user",
    );
  });

  it("allows many shared groups per user", async () => {
    const userId = await createUser();

    const first = await createGroup(userId);
    const second = await createGroup(userId);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
  });

  it("requires an existing creator", async () => {
    const { error } = await createGroup(crypto.randomUUID());

    expect(error?.code).toBe("23503");
  });

  it("is closed to the anon key", async () => {
    const { error } = await anonDb().from("groups").select("id");

    expect(error?.code).toBe("42501");
  });
});

describe("group_members table", () => {
  async function newGroup() {
    const userId = await createUser();
    const group = await createGroup(userId);
    return { userId, groupId: group.data!.id as string };
  }

  it("adds a member who has not left", async () => {
    const { userId, groupId } = await newGroup();

    const { data, error } = await db
      .from("group_members")
      .insert({ group_id: groupId, user_id: userId, default_share_weight: 1 })
      .select("joined_at, left_at")
      .single();

    expect(error).toBeNull();
    expect(data!.joined_at).toBeTruthy();
    expect(data!.left_at).toBeNull();
  });

  it("rejects a share weight of zero", async () => {
    const { userId, groupId } = await newGroup();

    const { error } = await db
      .from("group_members")
      .insert({ group_id: groupId, user_id: userId, default_share_weight: 0 });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("group_members_weight_positive");
  });

  it("rejects leaving before joining", async () => {
    const { userId, groupId } = await newGroup();

    const { error } = await db.from("group_members").insert({
      group_id: groupId,
      user_id: userId,
      default_share_weight: 1,
      joined_at: "2026-10-02T00:00:00Z",
      left_at: "2026-10-01T00:00:00Z",
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("group_members_left_after_join");
  });

  it("keeps one row per member of a group", async () => {
    const { userId, groupId } = await newGroup();
    const member = {
      group_id: groupId,
      user_id: userId,
      default_share_weight: 1,
    };

    await db.from("group_members").insert(member);
    const { error } = await db.from("group_members").insert(member);

    expect(error?.code).toBe("23505");
  });

  it("is closed to the anon key", async () => {
    const { error } = await anonDb().from("group_members").select("user_id");

    expect(error?.code).toBe("42501");
  });
});
