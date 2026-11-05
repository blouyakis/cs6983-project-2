// update_expense (#20): replaces an unsettled expense's description, amount,
// day and shares in one transaction and marks it edited. A settled expense,
// shares that don't add up, or an unknown expense change nothing.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { anonDb, cleanUp, createGroupWithMembers, db } from "./fixtures";

afterAll(cleanUp);

type Share = [userId: string, cents: number];

function toShares(shares: Share[]) {
  return shares.map(([userId, cents]) => ({
    user_id: userId,
    share_cents: cents,
  }));
}

// $60.00 paid by the first of three members, split evenly.
async function evenlySplitExpense() {
  const { groupId, memberIds } = await createGroupWithMembers(3);
  const { data, error } = await db.rpc("create_expense", {
    p_group_id: groupId,
    p_description: "Electricity",
    p_amount_cents: 6000,
    p_payer_id: memberIds[0],
    p_spent_on: "2026-10-20",
    p_shares: toShares(memberIds.map((id) => [id, 2000])),
  });
  if (error) {
    throw error;
  }
  return { groupId, memberIds, expenseId: data as string };
}

function updateExpense(
  expenseId: string,
  shares: Share[],
  overrides: Partial<{
    description: string;
    amountCents: number;
    spentOn: string;
  }> = {},
) {
  return db.rpc("update_expense", {
    p_expense_id: expenseId,
    p_description: overrides.description ?? "Electricity",
    p_amount_cents: overrides.amountCents ?? 6000,
    p_spent_on: overrides.spentOn ?? "2026-10-20",
    p_shares: toShares(shares),
  });
}

async function expenseRow(expenseId: string) {
  const { data } = await db
    .from("expenses")
    .select("description, amount_cents, spent_on, edited_at")
    .eq("id", expenseId)
    .single();
  return data!;
}

async function sharesOf(expenseId: string) {
  const { data } = await db
    .from("expense_shares")
    .select("user_id, share_cents")
    .eq("expense_id", expenseId)
    .order("share_cents");
  return data!;
}

describe("update_expense", () => {
  it("replaces the description, amount, day and shares, and marks the expense edited", async () => {
    const { memberIds, expenseId } = await evenlySplitExpense();
    const [payer, second] = memberIds;

    const { error } = await updateExpense(
      expenseId,
      [
        [payer, 2501],
        [second, 2500],
      ],
      { description: "Power", amountCents: 5001, spentOn: "2026-10-21" },
    );

    expect(error).toBeNull();
    expect(await expenseRow(expenseId)).toMatchObject({
      description: "Power",
      amount_cents: 5001,
      spent_on: "2026-10-21",
    });
    expect((await expenseRow(expenseId)).edited_at).not.toBeNull();
    expect(await sharesOf(expenseId)).toEqual([
      { user_id: second, share_cents: 2500 },
      { user_id: payer, share_cents: 2501 },
    ]);
  });

  it("rejects shares that don't add up to the new amount, and changes nothing", async () => {
    const { memberIds, expenseId } = await evenlySplitExpense();
    const before = await expenseRow(expenseId);

    const { error } = await updateExpense(
      expenseId,
      [
        [memberIds[0], 2000],
        [memberIds[1], 2000],
      ],
      { amountCents: 5000 },
    );

    expect(error?.message).toBe(
      "The shares of an expense must add up to its amount.",
    );
    expect(await expenseRow(expenseId)).toEqual(before);
    expect(await sharesOf(expenseId)).toHaveLength(3);
  });

  it("refuses a settled expense, and changes nothing", async () => {
    const { groupId, memberIds, expenseId } = await evenlySplitExpense();
    const settlement = await db
      .from("settlements")
      .insert({
        group_id: groupId,
        started_by: memberIds[0],
        status: "closed",
        started_at: "2026-10-30T00:00:00Z",
        closed_at: "2026-10-31T00:00:00Z",
      })
      .select("id")
      .single();
    await db
      .from("expenses")
      .update({ settlement_id: settlement.data!.id })
      .eq("id", expenseId);
    const before = await expenseRow(expenseId);

    const { error } = await updateExpense(expenseId, [[memberIds[0], 100]], {
      amountCents: 100,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.message).toContain("settled");
    expect(await expenseRow(expenseId)).toEqual(before);
  });

  it("refuses an expense that doesn't exist", async () => {
    const { memberIds } = await createGroupWithMembers(1);

    const { error } = await updateExpense(randomUUID(), [[memberIds[0], 6000]]);

    expect(error?.code).toBe("P0002");
  });

  it("refuses a share for someone outside the group, and changes nothing", async () => {
    const { memberIds, expenseId } = await evenlySplitExpense();
    const { memberIds: others } = await createGroupWithMembers(1);
    const before = await sharesOf(expenseId);

    const { error } = await updateExpense(expenseId, [
      [memberIds[0], 3000],
      [others[0], 3000],
    ]);

    expect(error).not.toBeNull();
    expect(await sharesOf(expenseId)).toEqual(before);
  });

  it("is only callable with the service role", async () => {
    const { memberIds, expenseId } = await evenlySplitExpense();

    const { error } = await anonDb().rpc("update_expense", {
      p_expense_id: expenseId,
      p_description: "Hacked",
      p_amount_cents: 1,
      p_spent_on: "2026-10-20",
      p_shares: toShares([[memberIds[0], 1]]),
    });

    expect(error).not.toBeNull();
    expect((await expenseRow(expenseId)).description).toBe("Electricity");
  });
});
