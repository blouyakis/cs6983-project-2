// ensure_personal_spaces (#66): gives a personal space to every user who has
// none, and leaves users who have one alone. The migration calls it once to
// backfill accounts created before registration made one; it stays callable
// so the backfill can be repeated safely.
import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createUser,
  db,
  trackUser,
  uniqueEmail,
} from "./fixtures";

afterAll(cleanUp);

async function personalSpacesOf(userId: string) {
  const { data, error } = await db
    .from("groups")
    .select(
      "id, name, is_personal, group_members(user_id, default_share_weight, left_at)",
    )
    .eq("created_by", userId)
    .eq("is_personal", true);
  if (error) {
    throw error;
  }
  return data;
}

async function ensure() {
  const { error } = await db.rpc("ensure_personal_spaces");
  expect(error).toBeNull();
}

describe("ensure_personal_spaces", () => {
  it("gives a user with no personal space one, with their only membership at weight 1", async () => {
    // createUser inserts into users directly, like accounts from before #66.
    const userId = await createUser();
    expect(await personalSpacesOf(userId)).toHaveLength(0);

    await ensure();

    const spaces = await personalSpacesOf(userId);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]).toMatchObject({
      name: "Personal space",
      is_personal: true,
    });
    expect(spaces[0].group_members).toEqual([
      { user_id: userId, default_share_weight: 1, left_at: null },
    ]);
  });

  it("leaves a user who already has one with exactly one, however often it runs", async () => {
    const { data: userId } = await db.rpc("register_user", {
      p_email: uniqueEmail(),
      p_password_hash: "hash",
      p_name: "Ana",
    });
    trackUser(userId as string);
    const before = await personalSpacesOf(userId as string);
    expect(before).toHaveLength(1);

    await ensure();
    await ensure();

    const after = await personalSpacesOf(userId as string);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before[0].id);
  });

  it("cannot be called with the anon key", async () => {
    const { error } = await anonDb().rpc("ensure_personal_spaces");

    expect(error?.code).toBe("42501");
  });
});
