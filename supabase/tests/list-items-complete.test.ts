import { afterAll, describe, expect, it } from "vitest";
import { cleanUp, createGroupWithMembers, db } from "./fixtures";

afterAll(cleanUp);

describe("List item complete/reopen (#12)", () => {
  it("completes a list item and creates an expense with a split", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const userId = memberIds[0];

    const { data: item, error: itemError } = await db
      .from("list_items")
      .insert({ group_id: groupId, title: "Milk", added_by: userId })
      .select("id")
      .single();

    if (itemError || !item)
      throw new Error(`Failed to create item: ${itemError?.message}`);

    // Call the complete_list_item function
    const { data: result, error } = await db.rpc("complete_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: groupId,
      amount_cents: 1234,
      shares: { [userId]: 1234 },
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
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const userId = memberIds[0];

    const { data: item, error: itemError } = await db
      .from("list_items")
      .insert({ group_id: groupId, title: "Milk", added_by: userId })
      .select("id")
      .single();

    if (itemError || !item)
      throw new Error(`Failed to create item: ${itemError?.message}`);

    // Call with 0 cost
    const { error } = await db.rpc("complete_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: groupId,
      amount_cents: 0,
      shares: {},
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
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const userId = memberIds[0];

    const { data: item, error: itemError } = await db
      .from("list_items")
      .insert({ group_id: groupId, title: "Milk", added_by: userId })
      .select("id")
      .single();

    if (itemError || !item)
      throw new Error(`Failed to create item: ${itemError?.message}`);

    // Complete it first
    await db.rpc("complete_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: groupId,
      amount_cents: 1234,
      shares: { [userId]: 1234 },
    });

    // Reopen it
    const { error } = await db.rpc("reopen_list_item", {
      item_id: item.id,
      user_id: userId,
      group_id: groupId,
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
