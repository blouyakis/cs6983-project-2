// A former member's balance stays as it was when they left (#22, AGENTS.md
// Sections 6.7 and 6.8). They left at zero and can no longer settle, so no
// write may change their share: a new cost can't include them, and an
// expense they have a non-zero share in can't be edited, deleted or its list
// item unchecked until a settle-up locks it. The database is the last word:
// P0001 with the hint member_left, which the app answers with 409.
import { afterAll, describe, expect, it } from "vitest";
import { cleanUp, createGroupWithMembers, db } from "./fixtures";

afterAll(cleanUp);

type Shares = Record<string, number>;

async function createExpense(
  groupId: string,
  payerId: string,
  amountCents: number,
  shares: Shares,
) {
  return db.rpc("create_expense", {
    p_group_id: groupId,
    p_description: "Groceries",
    p_amount_cents: amountCents,
    p_payer_id: payerId,
    p_spent_on: "2026-11-01",
    p_shares: Object.entries(shares).map(([userId, cents]) => ({
      user_id: userId,
      share_cents: cents,
    })),
  });
}

async function mustCreateExpense(
  groupId: string,
  payerId: string,
  amountCents: number,
  shares: Shares,
): Promise<string> {
  const { data, error } = await createExpense(
    groupId,
    payerId,
    amountCents,
    shares,
  );
  if (error) {
    throw error;
  }
  return data as string;
}

function updateExpense(
  expenseId: string,
  amountCents: number,
  shares: Shares,
  description = "Groceries",
) {
  return db.rpc("update_expense", {
    p_expense_id: expenseId,
    p_description: description,
    p_amount_cents: amountCents,
    p_spent_on: "2026-11-02",
    p_shares: Object.entries(shares).map(([userId, cents]) => ({
      user_id: userId,
      share_cents: cents,
    })),
  });
}

async function payAndConfirm(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  amountCents: number,
): Promise<void> {
  const recorded = await db.rpc("record_payment", {
    p_group_id: groupId,
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
    p_amount_cents: amountCents,
  });
  if (recorded.error) {
    throw recorded.error;
  }
  const confirmed = await db.rpc("confirm_payment", {
    p_payment_id: recorded.data,
  });
  if (confirmed.error) {
    throw confirmed.error;
  }
}

async function leave(groupId: string, userId: string): Promise<void> {
  const { error } = await db.rpc("leave_group", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
}

async function sharesOf(expenseId: string): Promise<Shares> {
  const { data, error } = await db
    .from("expense_shares")
    .select("user_id, share_cents")
    .eq("expense_id", expenseId);
  if (error) {
    throw error;
  }
  return Object.fromEntries(
    data.map((share) => [share.user_id as string, share.share_cents as number]),
  );
}

async function expenseExists(expenseId: string): Promise<boolean> {
  const { data, error } = await db
    .from("expenses")
    .select("id")
    .eq("id", expenseId);
  if (error) {
    throw error;
  }
  return data.length === 1;
}

async function expenseCount(groupId: string): Promise<number> {
  const { count, error } = await db
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function addItem(groupId: string, addedBy: string): Promise<string> {
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

async function itemStatus(itemId: string): Promise<string> {
  const { data, error } = await db
    .from("list_items")
    .select("status")
    .eq("id", itemId)
    .single();
  if (error) {
    throw error;
  }
  return data.status as string;
}

// Ana paid 1000 for herself and Ren, Ren paid her back 500, and Ren left at
// a zero balance. Jo is still in the group. The expense is unsettled, so
// Ren still has a 500 share in it.
async function renLeftWithAShare() {
  const { groupId, memberIds } = await createGroupWithMembers(3);
  const [ana, ren, jo] = memberIds;
  const expenseId = await mustCreateExpense(groupId, ana, 1000, {
    [ana]: 500,
    [ren]: 500,
  });
  await payAndConfirm(groupId, ren, ana, 500);
  await leave(groupId, ren);
  return { groupId, ana, ren, jo, expenseId };
}

describe("a new cost", () => {
  it("can't be shared with a member who left", async () => {
    const { groupId, ana, ren } = await renLeftWithAShare();

    const { error } = await createExpense(groupId, ana, 1000, {
      [ana]: 500,
      [ren]: 500,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await expenseCount(groupId)).toBe(1);
  });

  it("can't be paid by a member who left", async () => {
    const { groupId, ren, jo } = await renLeftWithAShare();

    const { error } = await createExpense(groupId, ren, 1000, {
      [ren]: 500,
      [jo]: 500,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await expenseCount(groupId)).toBe(1);
  });

  it("can still be shared among the current members", async () => {
    const { groupId, ana, jo } = await renLeftWithAShare();

    const { error } = await createExpense(groupId, ana, 1000, {
      [ana]: 500,
      [jo]: 500,
    });

    expect(error).toBeNull();
    expect(await expenseCount(groupId)).toBe(2);
  });

  it("from checking off an item can't be shared with a member who left", async () => {
    const { groupId, ana, ren } = await renLeftWithAShare();
    const itemId = await addItem(groupId, ana);

    const { error } = await db.rpc("complete_list_item", {
      item_id: itemId,
      user_id: ana,
      group_id: groupId,
      amount_cents: 1000,
      shares: { [ana]: 500, [ren]: 500 },
    });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await itemStatus(itemId)).toBe("open");
    expect(await expenseCount(groupId)).toBe(1);
  });
});

// Locked like a settled expense (#22 review): any edit is refused while a
// member who left has a non-zero share, even one that only changes the
// description, so the rule is the same as for deleting.
describe("editing an expense a former member shares", () => {
  it("is refused, even when only the description and day change", async () => {
    const { ana, ren, expenseId } = await renLeftWithAShare();

    const { error } = await updateExpense(
      expenseId,
      1000,
      { [ana]: 500, [ren]: 500 },
      "Weekly groceries",
    );

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
  });

  it("can't change the former member's share", async () => {
    const { ana, ren, expenseId } = await renLeftWithAShare();

    const { error } = await updateExpense(expenseId, 1000, {
      [ana]: 600,
      [ren]: 400,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await sharesOf(expenseId)).toEqual({ [ana]: 500, [ren]: 500 });
  });

  it("can't take the former member out of it", async () => {
    const { ana, ren, expenseId } = await renLeftWithAShare();

    const { error } = await updateExpense(expenseId, 1000, { [ana]: 1000 });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await sharesOf(expenseId)).toEqual({ [ana]: 500, [ren]: 500 });
  });

  it("is allowed when their share is zero", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren, jo] = memberIds;
    const expenseId = await mustCreateExpense(groupId, ana, 1000, {
      [ana]: 1000,
      [ren]: 0,
    });
    await leave(groupId, ren);

    const { error } = await updateExpense(expenseId, 1200, {
      [ana]: 600,
      [ren]: 0,
      [jo]: 600,
    });

    expect(error).toBeNull();
    expect(await sharesOf(expenseId)).toEqual({
      [ana]: 600,
      [ren]: 0,
      [jo]: 600,
    });
  });

  it("can't give a former member a share they didn't have", async () => {
    const { groupId, ana, ren, jo } = await renLeftWithAShare();
    const expenseId = await mustCreateExpense(groupId, ana, 1000, {
      [ana]: 500,
      [jo]: 500,
    });

    const { error } = await updateExpense(expenseId, 1000, {
      [ana]: 400,
      [ren]: 100,
      [jo]: 500,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await sharesOf(expenseId)).toEqual({ [ana]: 500, [jo]: 500 });
  });
});

describe("deleting an expense a former member shares", () => {
  it("is refused while their share isn't zero", async () => {
    const { expenseId } = await renLeftWithAShare();

    const { error } = await db.rpc("delete_expense", {
      p_expense_id: expenseId,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await expenseExists(expenseId)).toBe(true);
  });

  it("is allowed when their share is zero", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren] = memberIds;
    const expenseId = await mustCreateExpense(groupId, ana, 1000, {
      [ana]: 1000,
      [ren]: 0,
    });
    await leave(groupId, ren);

    const { error } = await db.rpc("delete_expense", {
      p_expense_id: expenseId,
    });

    expect(error).toBeNull();
    expect(await expenseExists(expenseId)).toBe(false);
  });

  it("by unchecking its list item is refused, and the item stays done", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren] = memberIds;
    const itemId = await addItem(groupId, ana);
    const completed = await db.rpc("complete_list_item", {
      item_id: itemId,
      user_id: ana,
      group_id: groupId,
      amount_cents: 1000,
      shares: { [ana]: 500, [ren]: 500 },
    });
    if (completed.error) {
      throw completed.error;
    }
    await payAndConfirm(groupId, ren, ana, 500);
    await leave(groupId, ren);

    const { error } = await db.rpc("reopen_list_item", {
      item_id: itemId,
      user_id: ana,
      group_id: groupId,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("member_left");
    expect(await itemStatus(itemId)).toBe("done");
    expect(await expenseExists(completed.data as string)).toBe(true);
  });
});
