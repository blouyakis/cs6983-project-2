import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

const NOT_ADDING_UP = "The shares of an expense must add up to its amount.";

type Share = [userId: string, cents: number];

function createExpense(
  groupId: string,
  payerId: string,
  amountCents: number,
  shares: Share[],
  description = "Electricity",
) {
  return db.rpc("create_expense", {
    p_group_id: groupId,
    p_description: description,
    p_amount_cents: amountCents,
    p_payer_id: payerId,
    p_spent_on: "2026-10-20",
    p_shares: shares.map(([userId, cents]) => ({
      user_id: userId,
      share_cents: cents,
    })),
  });
}

// $60.00 paid by the first of three members, split evenly.
async function evenlySplitExpense() {
  const { groupId, memberIds } = await createGroupWithMembers(3);
  const shares: Share[] = memberIds.map((id) => [id, 2000]);
  const { data, error } = await createExpense(
    groupId,
    memberIds[0],
    6000,
    shares,
  );
  if (error) {
    throw error;
  }
  return { groupId, memberIds, expenseId: data as string };
}

async function sharesOf(expenseId: string) {
  const { data } = await db
    .from("expense_shares")
    .select("user_id, share_cents")
    .eq("expense_id", expenseId);
  return data;
}

describe("shares add up to the expense", () => {
  it("creates an expense with its shares in one call", async () => {
    const { memberIds, expenseId } = await evenlySplitExpense();

    const expense = await db
      .from("expenses")
      .select("amount_cents, payer_id")
      .eq("id", expenseId)
      .single();
    const shares = await sharesOf(expenseId);

    expect(expense.data).toEqual({
      amount_cents: 6000,
      payer_id: memberIds[0],
    });
    expect(shares).toHaveLength(3);
    expect(shares!.reduce((sum, row) => sum + row.share_cents, 0)).toBe(6000);
  });

  it("accepts shares that differ by a cent, as when $10.00 is split three ways", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);

    const { error } = await createExpense(groupId, memberIds[0], 1000, [
      [memberIds[0], 334],
      [memberIds[1], 333],
      [memberIds[2], 333],
    ]);

    expect(error).toBeNull();
  });

  it("rejects shares that don't add up, and stores nothing", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const description = `Short by a cent ${randomUUID()}`;

    const { error } = await createExpense(
      groupId,
      memberIds[0],
      6000,
      [
        [memberIds[0], 2000],
        [memberIds[1], 2000],
        [memberIds[2], 1999],
      ],
      description,
    );
    const stored = await db
      .from("expenses")
      .select("id")
      .eq("description", description);

    expect(error?.code).toBe("23514");
    expect(error?.message).toBe(NOT_ADDING_UP);
    expect(stored.data).toEqual([]);
  });

  it("rejects an expense with a cost but no shares", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db.from("expenses").insert({
      group_id: groupId,
      description: "Electricity",
      amount_cents: 6000,
      payer_id: memberIds[0],
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toBe(NOT_ADDING_UP);
  });

  it("rejects changing one share on its own", async () => {
    const { memberIds, expenseId } = await evenlySplitExpense();

    const { error } = await db
      .from("expense_shares")
      .update({ share_cents: 2500 })
      .eq("expense_id", expenseId)
      .eq("user_id", memberIds[1]);

    expect(error?.message).toBe(NOT_ADDING_UP);
    expect(await sharesOf(expenseId)).toContainEqual({
      user_id: memberIds[1],
      share_cents: 2000,
    });
  });

  it("rejects removing one share on its own", async () => {
    const { memberIds, expenseId } = await evenlySplitExpense();

    const { error } = await db
      .from("expense_shares")
      .delete()
      .eq("expense_id", expenseId)
      .eq("user_id", memberIds[2]);

    expect(error?.message).toBe(NOT_ADDING_UP);
    expect(await sharesOf(expenseId)).toHaveLength(3);
  });

  it("rejects changing the amount on its own", async () => {
    const { expenseId } = await evenlySplitExpense();

    const { error } = await db
      .from("expenses")
      .update({ amount_cents: 6100 })
      .eq("id", expenseId);

    expect(error?.message).toBe(NOT_ADDING_UP);
  });

  it("still deletes an expense together with its shares", async () => {
    const { expenseId } = await evenlySplitExpense();

    const { error } = await db.from("expenses").delete().eq("id", expenseId);

    expect(error).toBeNull();
    expect(await sharesOf(expenseId)).toEqual([]);
  });

  it("rejects a payer who is not a member", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const stranger = await createUser();

    const { error } = await createExpense(groupId, stranger, 100, [
      [memberIds[0], 100],
    ]);

    expect(error?.code).toBe("23503");
  });

  it("cannot be called with the anon key", async () => {
    const { error } = await anonDb().rpc("create_expense", {
      p_group_id: randomUUID(),
      p_description: "Electricity",
      p_amount_cents: 0,
      p_payer_id: randomUUID(),
      p_spent_on: "2026-10-20",
      p_shares: [],
    });

    expect(error?.code).toBe("42501");
  });
});
