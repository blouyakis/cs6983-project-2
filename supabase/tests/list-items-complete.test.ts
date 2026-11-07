import { afterAll, describe, expect, it } from "vitest";
import { cleanUp, createUser, db } from "./fixtures";

afterAll(cleanUp);

describe("List item complete/reopen (#12)", () => {
  it("completes a list item and creates an expense with a split", async () => {
    const userId = await createUser();
    const { data: group } = await db
      .from("groups")
      .insert({ name: "Test", is_personal: false, created_by: userId })
      .select("id")
      .single();

    await db
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, joined_at: new Date() });

    const { data: item } = await db
      .from("list_items")
      .insert({ group_id: group.id, title: "Milk", added_by: userId })
      .select("id")
      .single();

    // Call the complete_list_item function
    const { data: result, error } = await db.rpc("complete_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: group.id,
      amount_cents: 1234,
      shares: JSON.stringify({ [userId]: 1234 }),
    });

    expect(error).toBeNull();
    expect(result).toBeDefined();

    // Verify item is done
    const { data: updatedItem } = await db
      .from("list_items")
      .select("status, completed_by, expense_id")
      .eq("id", item.id)
      .single();

    expect(updatedItem?.status).toBe("done");
    expect(updatedItem?.completed_by).toBe(userId);
    expect(updatedItem?.expense_id).toBeDefined();
  });

  it("completes an item with no cost and creates no expense", async () => {
    const userId = await createUser();
    const { data: group } = await db
      .from("groups")
      .insert({ name: "Test", is_personal: false, created_by: userId })
      .select("id")
      .single();

    await db
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, joined_at: new Date() });

    const { data: item } = await db
      .from("list_items")
      .insert({ group_id: group.id, title: "Milk", added_by: userId })
      .select("id")
      .single();

    // Call with 0 cost
    const { error } = await db.rpc("complete_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: group.id,
      amount_cents: 0,
      shares: JSON.stringify({}),
    });

    expect(error).toBeNull();

    const { data: updatedItem } = await db
      .from("list_items")
      .select("status, expense_id")
      .eq("id", item.id)
      .single();

    expect(updatedItem?.status).toBe("done");
    expect(updatedItem?.expense_id).toBeNull();
  });

  it("reopens a completed item and deletes its expense", async () => {
    const userId = await createUser();
    const { data: group } = await db
      .from("groups")
      .insert({ name: "Test", is_personal: false, created_by: userId })
      .select("id")
      .single();

    await db
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId, joined_at: new Date() });

    const { data: item } = await db
      .from("list_items")
      .insert({ group_id: group.id, title: "Milk", added_by: userId })
      .select("id")
      .single();

    // Complete it first
    await db.rpc("complete_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: group.id,
      amount_cents: 1234,
      shares: JSON.stringify({ [userId]: 1234 }),
    });

    // Reopen it
    const { error } = await db.rpc("reopen_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: group.id,
    });

    expect(error).toBeNull();

    const { data: reopenedItem } = await db
      .from("list_items")
      .select("status, expense_id")
      .eq("id", item.id)
      .single();

    expect(reopenedItem?.status).toBe("open");
    expect(reopenedItem?.expense_id).toBeNull();
  });
});
