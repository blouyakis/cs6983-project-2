import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { inject } from "vitest";
import { getDb } from "@/lib/db/client";

export const db = getDb();

// What the browser would hold if it ever talked to Supabase directly.
export function anonDb(): SupabaseClient {
  return createClient(inject("supabaseUrl"), inject("anonKey"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// A direct connection to the local database, for tests that need to hold a
// transaction open between steps, such as two transactions waiting on each
// other's locks (#124). PostgREST runs each request as its own transaction, so
// it can't interleave two. Only tests use it; the app goes through lib/db.
export async function connectDirect(): Promise<Client> {
  const client = new Client({ connectionString: inject("dbUrl") });
  await client.connect();
  return client;
}

// The database's clock, for left_at and other times a test writes, so they
// can't tie or cross the times the database stamps itself (#75).
export async function dbNow(): Promise<string> {
  const { data, error } = await db.rpc("db_now");
  if (error) {
    throw error;
  }
  return data as string;
}

export function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

const createdUserIds: string[] = [];

export async function createUser(): Promise<string> {
  const { data, error } = await db
    .from("users")
    .insert({ email: uniqueEmail(), password_hash: "hash", name: "Test" })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  createdUserIds.push(data.id);
  return data.id;
}

export function trackUser(id: string): void {
  createdUserIds.push(id);
}

// A shared group whose `count` new users are all current members. The first
// one created it.
export async function createGroupWithMembers(
  count: number,
): Promise<{ groupId: string; memberIds: string[] }> {
  const memberIds = await Promise.all(
    Array.from({ length: count }, () => createUser()),
  );
  const group = await db
    .from("groups")
    .insert({ name: "Flat", created_by: memberIds[0] })
    .select("id")
    .single();
  if (group.error) {
    throw group.error;
  }
  const groupId: string = group.data.id;
  const { error } = await db.from("group_members").insert(
    memberIds.map((userId) => ({
      group_id: groupId,
      user_id: userId,
      default_share_weight: 1,
    })),
  );
  if (error) {
    throw error;
  }
  return { groupId, memberIds };
}

// Foreign keys are `on delete restrict`, so remove children first.
export async function cleanUp(): Promise<void> {
  const ids = createdUserIds.splice(0);
  if (ids.length === 0) {
    return;
  }
  const groups = await db.from("groups").select("id").in("created_by", ids);
  if (groups.error) {
    throw groups.error;
  }
  const groupIds = groups.data.map((group) => group.id as string);
  const steps = [
    () => db.from("list_items").delete().in("group_id", groupIds),
    () => db.from("payments").delete().in("group_id", groupIds),
    () => db.from("expenses").delete().in("group_id", groupIds),
    () => db.from("settlements").delete().in("group_id", groupIds),
  ];
  // An ensure_personal_spaces call in another file used to give one of these
  // users a personal space between the groups step and the users step (#83).
  // Since #79 that file runs only after the parallel ones, so this shouldn't
  // happen; the retry stays as a safety net. When the users step hits the
  // foreign key, these three run once more.
  const userSteps = [
    () => db.from("group_members").delete().in("user_id", ids),
    () => db.from("groups").delete().in("created_by", ids),
    () => db.from("users").delete().in("id", ids),
  ];
  for (const step of steps) {
    const { error } = await step();
    // Fail loudly: a new table that references users must be cleaned here too.
    if (error) {
      throw error;
    }
  }
  for (const attempt of [1, 2]) {
    let failed = null;
    for (const step of userSteps) {
      const { error } = await step();
      if (error) {
        failed = error;
        break;
      }
    }
    if (!failed) {
      return;
    }
    if (attempt === 2 || failed.code !== "23503") {
      throw failed;
    }
  }
}
