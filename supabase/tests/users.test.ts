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

describe("users table", () => {
  it("stores a lowercase email and reads it back", async () => {
    const email = uniqueEmail();
    const { data, error } = await db
      .from("users")
      .insert({ email, password_hash: "hash", name: "Ana" })
      .select("id, email, created_at, updated_at")
      .single();

    expect(error).toBeNull();
    trackUser(data!.id);
    expect(data!.email).toBe(email);
    expect(data!.created_at).toBeTruthy();
    expect(data!.updated_at).toBeTruthy();
  });

  it("rejects an email that is not lowercase", async () => {
    const { error } = await db
      .from("users")
      .insert({ email: "Ana@Example.com", password_hash: "hash", name: "Ana" });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("users_email_lowercase");
  });

  it("rejects a second account with the same email", async () => {
    const email = uniqueEmail();
    const first = await db
      .from("users")
      .insert({ email, password_hash: "hash", name: "Ana" })
      .select("id")
      .single();
    trackUser(first.data!.id);

    const { error } = await db
      .from("users")
      .insert({ email, password_hash: "hash", name: "Ana again" });

    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("users_email_key");
  });

  it("requires a name", async () => {
    const { error } = await db
      .from("users")
      .insert({ email: uniqueEmail(), password_hash: "hash" });

    expect(error?.code).toBe("23502");
  });

  it("moves updated_at forward on every update", async () => {
    const id = await createUser();
    const before = await db
      .from("users")
      .select("updated_at")
      .eq("id", id)
      .single();

    const after = await db
      .from("users")
      .update({ name: "Renamed" })
      .eq("id", id)
      .select("updated_at")
      .single();

    expect(after.error).toBeNull();
    expect(Date.parse(after.data!.updated_at)).toBeGreaterThan(
      Date.parse(before.data!.updated_at),
    );
  });

  it("ignores an updated_at sent by the caller", async () => {
    const id = await createUser();

    const { data } = await db
      .from("users")
      .update({ name: "Renamed", updated_at: "2000-01-01T00:00:00Z" })
      .eq("id", id)
      .select("updated_at")
      .single();

    expect(Date.parse(data!.updated_at)).toBeGreaterThan(
      Date.parse("2026-01-01T00:00:00Z"),
    );
  });

  it("is closed to the anon key", async () => {
    const anon = anonDb();

    const read = await anon.from("users").select("id");
    const write = await anon
      .from("users")
      .insert({ email: uniqueEmail(), password_hash: "hash", name: "Eve" });

    expect(read.error?.code).toBe("42501");
    expect(write.error?.code).toBe("42501");
  });
});
