import { afterAll, describe, expect, it } from "vitest";
import { anonDb, cleanUp, db, trackUser, uniqueEmail } from "./fixtures";

afterAll(cleanUp);

async function register(email: string, name: string | null = "Ana") {
  const result = await db.rpc("register_user", {
    p_email: email,
    p_password_hash: "hash",
    p_name: name,
  });
  if (typeof result.data === "string") {
    trackUser(result.data);
  }
  return result;
}

describe("register_user", () => {
  it("creates the user, a personal space, and its only membership", async () => {
    const email = uniqueEmail();

    const { data: userId, error } = await register(email);

    expect(error).toBeNull();
    const user = await db
      .from("users")
      .select("email, name")
      .eq("id", userId)
      .single();
    expect(user.data).toEqual({ email, name: "Ana" });

    const groups = await db
      .from("groups")
      .select("id, name, is_personal")
      .eq("created_by", userId);
    expect(groups.data).toHaveLength(1);
    expect(groups.data![0]).toMatchObject({
      name: "Personal space",
      is_personal: true,
    });

    const members = await db
      .from("group_members")
      .select("group_id, user_id, default_share_weight, left_at")
      .eq("group_id", groups.data![0].id);
    expect(members.data).toEqual([
      {
        group_id: groups.data![0].id,
        user_id: userId,
        default_share_weight: 1,
        left_at: null,
      },
    ]);
  });

  it("stores the email trimmed and lowercase", async () => {
    const email = uniqueEmail();

    const { data: userId } = await register(`  ${email.toUpperCase()} `);

    const user = await db
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();
    expect(user.data?.email).toBe(email);
  });

  it("rejects an email that is already taken, in any case", async () => {
    const email = uniqueEmail();
    await register(email);

    const { error } = await register(email.toUpperCase());

    expect(error?.code).toBe("23505");
    const users = await db.from("users").select("id").eq("email", email);
    expect(users.data).toHaveLength(1);
  });

  it("requires a name", async () => {
    const { error } = await register(uniqueEmail(), null);

    expect(error?.code).toBe("23502");
  });

  it("cannot be called with the anon key", async () => {
    const { error } = await anonDb().rpc("register_user", {
      p_email: uniqueEmail(),
      p_password_hash: "hash",
      p_name: "Eve",
    });

    expect(error?.code).toBe("42501");
  });
});
