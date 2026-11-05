// register (#66) with the real service and lib/db against the real database:
// every new account gets exactly one personal space, a taken email is a 409
// with no second space, and two registrations racing for one email leave one
// account.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/http/errors";
import { register } from "@/lib/services/auth-service";
import { cleanUp, db, trackUser, uniqueEmail } from "./fixtures";

// register signs a session token, which needs the secret; see
// group-access-api.test.ts.
const originalSecret = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
});
afterAll(async () => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
  await cleanUp();
});

async function registerAna(email: string) {
  const result = await register({
    name: "Ana",
    email,
    password: "correct horse",
  });
  trackUser(result.user.id);
  return result;
}

async function personalSpacesOf(userId: string) {
  const { data, error } = await db
    .from("groups")
    .select(
      "id, name, is_personal, created_by, group_members(user_id, default_share_weight, left_at)",
    )
    .eq("created_by", userId)
    .eq("is_personal", true);
  if (error) {
    throw error;
  }
  return data;
}

describe("register", () => {
  it("creates exactly one personal space, created by the user, with them as its only member at weight 1", async () => {
    const { user } = await registerAna(uniqueEmail());

    const spaces = await personalSpacesOf(user.id);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]).toMatchObject({
      name: "Personal space",
      is_personal: true,
      created_by: user.id,
    });
    expect(spaces[0].group_members).toEqual([
      { user_id: user.id, default_share_weight: 1, left_at: null },
    ]);
  });

  it("returns the user without the password hash, as login does", async () => {
    const email = uniqueEmail();

    const { user, token } = await registerAna(email);

    expect(user).toEqual({
      id: expect.any(String),
      email,
      name: "Ana",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect(token).toEqual(expect.any(String));
  });

  it("is a 409 for a taken email, in any case and with spaces around it, with no second space", async () => {
    const email = uniqueEmail();
    const { user } = await registerAna(email);

    await expect(registerAna(email.toUpperCase())).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(registerAna(`  ${email} `)).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect(await personalSpacesOf(user.id)).toHaveLength(1);
    const { data: users } = await db
      .from("users")
      .select("id")
      .eq("email", email);
    expect(users).toHaveLength(1);
  });

  it("lets exactly one of two simultaneous registrations with the same email through", async () => {
    const email = uniqueEmail();

    const results = await Promise.allSettled([
      registerAna(email),
      registerAna(email),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictError,
    );
    const { data: users } = await db
      .from("users")
      .select("id")
      .eq("email", email);
    expect(users).toHaveLength(1);
    expect(await personalSpacesOf(users![0].id)).toHaveLength(1);
  });
});
