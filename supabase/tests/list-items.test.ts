import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

// A fixed time, so no test depends on this machine's clock matching the database's.
const DONE_AT = "2026-10-21T00:00:00Z";

async function addItem(groupId: string, addedBy: string) {
  const { data, error } = await db
    .from("list_items")
    .insert({ group_id: groupId, title: "Milk", added_by: addedBy })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id as string;
}

// $5.00 paid by `payerId`, all of it their share.
async function addExpense(groupId: string, payerId: string) {
  const { data, error } = await db.rpc("create_expense", {
    p_group_id: groupId,
    p_description: "Milk",
    p_amount_cents: 500,
    p_payer_id: payerId,
    p_spent_on: "2026-10-21",
    p_shares: [{ user_id: payerId, share_cents: 500 }],
  });
  if (error) {
    throw error;
  }
  return data as string;
}

function done(completedBy: string, expenseId: string | null = null) {
  return {
    status: "done",
    completed_by: completedBy,
    completed_at: DONE_AT,
    expense_id: expenseId,
  };
}

describe("list_items table", () => {
  it("adds an open item with an optional quantity, note and estimate", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { data, error } = await db
      .from("list_items")
      .insert({
        group_id: groupId,
        title: "Milk",
        quantity: 2,
        note: "Oat",
        estimated_cents: 450,
        added_by: memberIds[0],
      })
      .select("status, completed_by, completed_at, expense_id, created_at")
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: "open",
      completed_by: null,
      completed_at: null,
      expense_id: null,
    });
    expect(data!.created_at).toBeTruthy();
  });

  it("rejects a quantity or estimate of zero or less", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const item = { group_id: groupId, title: "Milk", added_by: memberIds[0] };

    const quantity = await db
      .from("list_items")
      .insert({ ...item, quantity: 0 });
    const estimate = await db
      .from("list_items")
      .insert({ ...item, estimated_cents: 0 });

    expect(quantity.error?.message).toContain("list_items_quantity_positive");
    expect(estimate.error?.message).toContain("list_items_estimate_positive");
  });

  it("rejects an unknown status", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db.from("list_items").insert({
      group_id: groupId,
      title: "Milk",
      added_by: memberIds[0],
      status: "archived",
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("list_items_status_valid");
  });

  it("checks an item off with the expense it created", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const itemId = await addItem(groupId, memberIds[0]);
    const expenseId = await addExpense(groupId, memberIds[1]);

    const { error } = await db
      .from("list_items")
      .update(done(memberIds[1], expenseId))
      .eq("id", itemId);

    expect(error).toBeNull();
  });

  it("checks an item off with no cost", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const itemId = await addItem(groupId, memberIds[0]);

    const { error } = await db
      .from("list_items")
      .update(done(memberIds[0]))
      .eq("id", itemId);

    expect(error).toBeNull();
  });

  it("keeps completion details off an open item", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db.from("list_items").insert({
      group_id: groupId,
      title: "Milk",
      added_by: memberIds[0],
      completed_by: memberIds[0],
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("list_items_open_has_no_completion");
  });

  it("records who checked a done item off, and when", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const itemId = await addItem(groupId, memberIds[0]);

    const { error } = await db
      .from("list_items")
      .update({ ...done(memberIds[0]), completed_at: null })
      .eq("id", itemId);

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("list_items_done_has_completion");
  });

  it("only links an expense of the same group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const other = await createGroupWithMembers(1);
    const itemId = await addItem(groupId, memberIds[0]);
    const foreign = await addExpense(other.groupId, other.memberIds[0]);

    const { error } = await db
      .from("list_items")
      .update(done(memberIds[0], foreign))
      .eq("id", itemId);

    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("list_items_expense_in_group");
  });

  it("links each expense to at most one item", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const first = await addItem(groupId, memberIds[0]);
    const second = await addItem(groupId, memberIds[0]);
    const expenseId = await addExpense(groupId, memberIds[0]);
    await db
      .from("list_items")
      .update(done(memberIds[0], expenseId))
      .eq("id", first);

    const { error } = await db
      .from("list_items")
      .update(done(memberIds[0], expenseId))
      .eq("id", second);

    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("list_items_one_item_per_expense");
  });

  it("stays done, with no expense, when its expense is deleted", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const itemId = await addItem(groupId, memberIds[0]);
    const expenseId = await addExpense(groupId, memberIds[0]);
    await db
      .from("list_items")
      .update(done(memberIds[0], expenseId))
      .eq("id", itemId);

    const deleting = await db.from("expenses").delete().eq("id", expenseId);
    const item = await db
      .from("list_items")
      .select("status, expense_id, group_id")
      .eq("id", itemId)
      .single();

    expect(deleting.error).toBeNull();
    expect(item.data).toEqual({
      status: "done",
      expense_id: null,
      group_id: groupId,
    });
  });

  it("is added and checked off by members only", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const stranger = await createUser();
    const itemId = await addItem(groupId, memberIds[0]);

    const added = await db
      .from("list_items")
      .insert({ group_id: groupId, title: "Milk", added_by: stranger });
    const completed = await db
      .from("list_items")
      .update(done(stranger))
      .eq("id", itemId);

    expect(added.error?.code).toBe("23503");
    expect(added.error?.message).toContain("list_items_added_by_member");
    expect(completed.error?.code).toBe("23503");
    expect(completed.error?.message).toContain(
      "list_items_completed_by_member",
    );
  });

  it("is closed to the anon key", async () => {
    const { error } = await anonDb().from("list_items").select("id");

    expect(error?.code).toBe("42501");
  });
});
