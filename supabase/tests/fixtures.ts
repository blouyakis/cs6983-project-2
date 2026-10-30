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

// Foreign keys are `on delete restrict`, so remove children first.
export async function cleanUp(): Promise<void> {
  const ids = createdUserIds.splice(0);
  if (ids.length === 0) {
    return;
  }
  await db.from("group_members").delete().in("user_id", ids);
  await db.from("groups").delete().in("created_by", ids);
  await db.from("users").delete().in("id", ids);
}
