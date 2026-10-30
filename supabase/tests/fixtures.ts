import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { getDb } from "@/lib/db/client";

export const db = getDb();

// What the browser would hold if it ever talked to Supabase directly.
export function anonDb(): SupabaseClient {
  return createClient(inject("supabaseUrl"), inject("anonKey"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  const steps = [
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
}
