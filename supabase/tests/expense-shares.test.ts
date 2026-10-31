import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

// A $0 expense, so its shares can be written one request at a time.
async function zeroExpense(groupId: string, payerId: string): Promise<string> {
  const { data, error } = await db
    .from("expenses")
    .insert({
      group_id: groupId,
      description: "Free sample",
      amount_cents: 0,
      payer_id: payerId,
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id;
}

describe("expense_shares table", () => {
  it("stores a member's share", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const expenseId = await zeroExpense(groupId, memberIds[0]);

    const { error } = await db
      .from("expense_shares")
      .insert({ expense_id: expenseId, user_id: memberIds[1], share_cents: 0 });

    expect(error).toBeNull();
  });

  it("rejects a negative share", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const expenseId = await zeroExpense(groupId, memberIds[0]);

    const { error } = await db.from("expense_shares").insert({
      expense_id: expenseId,
      user_id: memberIds[0],
      share_cents: -1,
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("expense_shares_not_negative");
  });

  it("only gives shares to members of the expense's group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const other = await createGroupWithMembers(1);
    const stranger = await createUser();
    const expenseId = await zeroExpense(groupId, memberIds[0]);

    const toStranger = await db
      .from("expense_shares")
      .insert({ expense_id: expenseId, user_id: stranger, share_cents: 0 });
    const toOtherGroup = await db.from("expense_shares").insert({
      expense_id: expenseId,
      user_id: other.memberIds[0],
      share_cents: 0,
    });

    expect(toStranger.error?.code).toBe("23503");
    expect(toStranger.error?.message).toBe(
      "A share must belong to a member of the expense's group.",
    );
    expect(toOtherGroup.error?.code).toBe("23503");
  });

  it("keeps one share per person per expense", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const expenseId = await zeroExpense(groupId, memberIds[0]);
    const share = {
      expense_id: expenseId,
      user_id: memberIds[0],
      share_cents: 0,
    };

    await db.from("expense_shares").insert(share);
    const { error } = await db.from("expense_shares").insert(share);

    expect(error?.code).toBe("23505");
  });

  it("is deleted with its expense", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const expenseId = await zeroExpense(groupId, memberIds[0]);
    await db
      .from("expense_shares")
      .insert({ expense_id: expenseId, user_id: memberIds[0], share_cents: 0 });

    const deleting = await db.from("expenses").delete().eq("id", expenseId);
    const left = await db
      .from("expense_shares")
      .select("user_id")
      .eq("expense_id", expenseId);

    expect(deleting.error).toBeNull();
    expect(left.data).toEqual([]);
  });

  it("is closed to the anon key", async () => {
    const { error } = await anonDb().from("expense_shares").select("user_id");

    expect(error?.code).toBe("42501");
  });
});
