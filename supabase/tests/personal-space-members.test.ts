import { afterAll, describe, expect, it } from "vitest";
import {
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
  trackUser,
  uniqueEmail,
} from "./fixtures";

afterAll(cleanUp);

const CHECK_VIOLATION = "23514";
const OWNER_ONLY = "A personal space has only its owner as a member.";

function membership(groupId: string, userId: string) {
  return { group_id: groupId, user_id: userId, default_share_weight: 1 };
}

// An account registered the way the app does it, so its personal space and
// the owner's membership exist from the start. A user from createUser has no
// personal space, and ensure_personal_spaces, run by another test file at the
// same time, could give it one before this file makes its own (#79).
async function registeredOwner() {
  const { data, error } = await db.rpc("register_user", {
    p_email: uniqueEmail(),
    p_password_hash: "hash",
    p_name: "Ana",
  });
  if (error) {
    throw error;
  }
  const ownerId = data as string;
  trackUser(ownerId);
  const space = await db
    .from("groups")
    .select("id")
    .eq("created_by", ownerId)
    .eq("is_personal", true)
    .single();
  if (space.error) {
    throw space.error;
  }
  return { ownerId, spaceId: space.data.id as string };
}

// architecture.md Section 4: a personal space has exactly one member, its
// owner. inviteMember checks this too, but the database is the last word.
describe("personal space members", () => {
  it("lets register_user make the owner the member of their personal space", async () => {
    const { ownerId, spaceId } = await registeredOwner();

    const { data, error } = await db
      .from("group_members")
      .select("user_id")
      .eq("group_id", spaceId);

    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: ownerId }]);
  });

  it("rejects anyone else joining a personal space", async () => {
    const { spaceId } = await registeredOwner();
    const otherId = await createUser();

    const { error } = await db
      .from("group_members")
      .insert(membership(spaceId, otherId));

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toBe(OWNER_ONLY);
  });

  it("rejects someone else as the only member of a personal space", async () => {
    const { ownerId, spaceId } = await registeredOwner();
    await db
      .from("group_members")
      .delete()
      .eq("group_id", spaceId)
      .eq("user_id", ownerId);
    const otherId = await createUser();

    const { error } = await db
      .from("group_members")
      .insert(membership(spaceId, otherId));

    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects someone who left joining as a former member", async () => {
    const { spaceId } = await registeredOwner();
    const otherId = await createUser();

    const { error } = await db.from("group_members").insert({
      ...membership(spaceId, otherId),
      joined_at: "2026-10-01T00:00:00Z",
      left_at: "2026-10-02T00:00:00Z",
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects moving a membership into someone else's personal space", async () => {
    const { spaceId } = await registeredOwner();
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await db
      .from("group_members")
      .update({ group_id: spaceId })
      .eq("group_id", groupId)
      .eq("user_id", memberIds[1]);

    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects handing the owner's membership to someone else", async () => {
    const { ownerId, spaceId } = await registeredOwner();
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
