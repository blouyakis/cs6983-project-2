import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { db } from "./fixtures";

// supabase/seed.sql, loaded by `npx supabase db reset` and by `npx supabase
// start` on a new database. These tests only read it.
const DEMO_EMAIL = "demo@lifeboard.test";
const DEMO_PASSWORD = "lifeboard-demo";

async function demoUser() {
  const { data, error } = await db
    .from("users")
    .select("id, name, password_hash")
    .eq("email", DEMO_EMAIL)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

async function flat(demoId: string) {
  const { data } = await db
    .from("groups")
    .select("id")
    .eq("created_by", demoId)
    .eq("name", "Flat")
    .single();
  return data!.id as string;
}

describe("seed data", () => {
  it("has a demo account that logs in with the README password", async () => {
    const demo = await demoUser();

    expect(demo?.name).toBe("Demo");
    expect(await compare(DEMO_PASSWORD, demo!.password_hash)).toBe(true);
  });

  it("gives the demo account its personal space", async () => {
    const demo = await demoUser();

    const { data } = await db
      .from("groups")
      .select("id")
      .eq("created_by", demo!.id)
      .eq("is_personal", true);

    expect(data).toHaveLength(1);
  });

  it("has a shared group of three current members", async () => {
    const demo = await demoUser();
    const groupId = await flat(demo!.id);

    const { data } = await db
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .is("left_at", null);

    expect(data).toHaveLength(3);
    expect(data!.map((row) => row.user_id)).toContain(demo!.id);
  });

  it("has expenses in that group, paid by different members", async () => {
    const demo = await demoUser();
    const groupId = await flat(demo!.id);

    const { data } = await db
      .from("expenses")
      .select("payer_id, amount_cents, expense_shares(share_cents)")
      .eq("group_id", groupId);

    expect(data!.length).toBeGreaterThanOrEqual(3);
    expect(new Set(data!.map((row) => row.payer_id)).size).toBe(3);
    for (const expense of data!) {
      const shares = expense.expense_shares as { share_cents: number }[];
      expect(shares).toHaveLength(3);
    }
  });

  it("has an open list item, a checked-off one, and a confirmed payment", async () => {
    const demo = await demoUser();
    const groupId = await flat(demo!.id);

    const items = await db
      .from("list_items")
      .select("status, expense_id")
      .eq("group_id", groupId);
    const payments = await db
      .from("payments")
      .select("status")
      .eq("group_id", groupId);

    expect(items.data).toContainEqual({ status: "open", expense_id: null });
    expect(
      items.data!.some((item) => item.status === "done" && item.expense_id),
    ).toBe(true);
    expect(payments.data).toContainEqual({ status: "confirmed" });
  });
});
