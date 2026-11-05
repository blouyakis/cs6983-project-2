import { afterAll, describe, expect, it } from "vitest";
import { cleanUp, createGroupWithMembers, createUser, db } from "./fixtures";

afterAll(cleanUp);

const CHECK_VIOLATION = "23514";
const OWNER_ONLY = "A personal space has only its owner as a member.";

function membership(groupId: string, userId: string) {
  return { group_id: groupId, user_id: userId, default_share_weight: 1 };
}

// A personal space with no members yet, created by `ownerId`.
async function createPersonalSpace(ownerId: string): Promise<string> {
  const { data, error } = await db
    .from("groups")
    .insert({ name: "Personal space", is_personal: true, created_by: ownerId })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id as string;
}

// A personal space whose owner is already its member.
async function personalSpaceWithOwner() {
  const ownerId = await createUser();
  const spaceId = await createPersonalSpace(ownerId);
  const { error } = await db
    .from("group_members")
    .insert(membership(spaceId, ownerId));
  if (error) {
    throw error;
  }
  return { ownerId, spaceId };
}

// architecture.md Section 4: a personal space has exactly one member, its
// owner. inviteMember checks this too, but the database is the last word.
describe("personal space members", () => {
  it("lets the owner be the member of their personal space", async () => {
    const ownerId = await createUser();
    const spaceId = await createPersonalSpace(ownerId);

    const { error } = await db
      .from("group_members")
      .insert(membership(spaceId, ownerId));

    expect(error).toBeNull();
  });

  it("rejects anyone else joining a personal space", async () => {
    const { spaceId } = await personalSpaceWithOwner();
    const otherId = await createUser();

    const { error } = await db
      .from("group_members")
      .insert(membership(spaceId, otherId));

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toBe(OWNER_ONLY);
  });

  it("rejects someone else as the only member of a personal space", async () => {
    const ownerId = await createUser();
    const spaceId = await createPersonalSpace(ownerId);
    const otherId = await createUser();

    const { error } = await db
      .from("group_members")
      .insert(membership(spaceId, otherId));

    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects someone who left joining as a former member", async () => {
    const { spaceId } = await personalSpaceWithOwner();
    const otherId = await createUser();

    const { error } = await db.from("group_members").insert({
      ...membership(spaceId, otherId),
      joined_at: "2026-10-01T00:00:00Z",
      left_at: "2026-10-02T00:00:00Z",
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects moving a membership into someone else's personal space", async () => {
    const { spaceId } = await personalSpaceWithOwner();
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await db
      .from("group_members")
      .update({ group_id: spaceId })
      .eq("group_id", groupId)
      .eq("user_id", memberIds[1]);

    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects handing the owner's membership to someone else", async () => {
    const { ownerId, spaceId } = await personalSpaceWithOwner();
    const otherId = await createUser();

    const { error } = await db
      .from("group_members")
      .update({ user_id: otherId })
      .eq("group_id", spaceId)
      .eq("user_id", ownerId);

    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("still lets a shared group take new members", async () => {
    const { groupId } = await createGroupWithMembers(1);
    const newcomerId = await createUser();

    const { error } = await db
      .from("group_members")
      .insert(membership(groupId, newcomerId));

    expect(error).toBeNull();
  });
});
