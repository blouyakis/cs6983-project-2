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
const FIXED = "A personal space keeps its name, its owner and its kind.";

// Registered the way the app does it, so ensure_personal_spaces in another
// test file can't give the user a second space first (#79).
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

async function groupRow(groupId: string) {
  const { data, error } = await db
    .from("groups")
    .select("name, is_personal, created_by")
    .eq("id", groupId)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

// The members trigger keeps anyone but the owner out of a personal space. This
// keeps the groups row from undoing that: a personal space can't be renamed,
// handed to someone else, or turned into a shared group, and a shared group
// can't become one (architecture.md Section 4).
describe("personal space groups row", () => {
  it("rejects renaming a personal space", async () => {
    const { spaceId } = await registeredOwner();

    const { error } = await db
      .from("groups")
      .update({ name: "Me" })
      .eq("id", spaceId);

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(error?.message).toBe(FIXED);
    expect((await groupRow(spaceId)).name).toBe("Personal space");
  });

  it("rejects renaming a personal space through update_group", async () => {
    const { spaceId } = await registeredOwner();

    const { error } = await db.rpc("update_group", {
      p_group_id: spaceId,
      p_name: "Me",
      p_weights: null,
    });

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect((await groupRow(spaceId)).name).toBe("Personal space");
  });

  it("rejects handing a personal space to someone else", async () => {
    const { ownerId, spaceId } = await registeredOwner();
    const otherId = await createUser();

    const { error } = await db
      .from("groups")
      .update({ created_by: otherId })
      .eq("id", spaceId);

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect((await groupRow(spaceId)).created_by).toBe(ownerId);
  });

  it("rejects turning a personal space into a shared group", async () => {
    const { spaceId } = await registeredOwner();

    const { error } = await db
      .from("groups")
      .update({ is_personal: false })
      .eq("id", spaceId);

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect((await groupRow(spaceId)).is_personal).toBe(true);
  });

  it("rejects turning a shared group into a personal space", async () => {
    const { groupId } = await createGroupWithMembers(3);

    const { error } = await db
      .from("groups")
      .update({ is_personal: true })
      .eq("id", groupId);

    expect(error?.code).toBe(CHECK_VIOLATION);
    expect((await groupRow(groupId)).is_personal).toBe(false);
  });

  it("still lets a shared group be renamed", async () => {
    const { groupId } = await createGroupWithMembers(2);

    const { error } = await db.rpc("update_group", {
      p_group_id: groupId,
      p_name: "Dorm 4B",
      p_weights: null,
    });

    expect(error).toBeNull();
    expect((await groupRow(groupId)).name).toBe("Dorm 4B");
  });

  it("lets an update through that leaves the name, owner and kind as they are", async () => {
    const { ownerId, spaceId } = await registeredOwner();

    const { error } = await db
      .from("groups")
      .update({
        name: "Personal space",
        created_by: ownerId,
        is_personal: true,
      })
      .eq("id", spaceId);

    expect(error).toBeNull();
  });
});
