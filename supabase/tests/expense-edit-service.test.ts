// editExpense and removeExpense (#20) with the real service and lib/db
// against the real database: the issue's "tests first" list.
import { afterAll, describe, expect, it } from "vitest";
import { findExpense } from "@/lib/db/expenses";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import {
  editExpense,
  removeExpense,
} from "@/lib/services/expense-edit-service";
import { addExpense } from "@/lib/services/expense-service";
import type { UpdateExpenseInput } from "@/lib/validation/expense";
import { cleanUp, createGroupWithMembers, db, dbNow } from "./fixtures";

afterAll(cleanUp);

const DONE_AT = "2026-10-21T00:00:00Z";

// $12.34 paid by the first member, split evenly among all of them.
async function groupWithExpense(count = 3) {
  const { groupId, memberIds } = await createGroupWithMembers(count);
  const expense = await addExpense(memberIds[0], groupId, {
    description: "Electricity",
    amountCents: 1234,
    spentOn: "2026-11-02",
    mode: "even",
    sharedBy: memberIds,
  });
  return { groupId, memberIds, expenseId: expense.id };
}

function edit(
  sharedBy: string[],
  overrides: Partial<UpdateExpenseInput> = {},
): UpdateExpenseInput {
  return {
    description: "Power",
    amountCents: 3000,
    spentOn: "2026-11-03",
    mode: "even",
    sharedBy,
    ...overrides,
  } as UpdateExpenseInput;
}

async function settle(groupId: string, by: string, expenseId: string) {
  const settlement = await db
    .from("settlements")
    .insert({
      group_id: groupId,
      started_by: by,
      status: "closed",
      started_at: "2026-10-30T00:00:00Z",
      closed_at: "2026-10-31T00:00:00Z",
    })
    .select("id")
    .single();
  if (settlement.error) {
    throw settlement.error;
  }
  const { error } = await db
    .from("expenses")
    .update({ settlement_id: settlement.data.id })
    .eq("id", expenseId);
  if (error) {
    throw error;
  }
}

// left_at from the database's clock, the one that set joined_at, so it is
// never before it (#75).
async function leave(groupId: string, userId: string) {
  const { error } = await db
    .from("group_members")
    .update({ left_at: await dbNow() })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}

describe("editExpense", () => {
  it("lets the payer change the amount, description, day and split, and marks it edited", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    const [payer, second] = memberIds;

    const edited = await editExpense(
      payer,
      groupId,
      expenseId,
      edit([payer, second], { amountCents: 1001 }),
    );

    expect(edited).toMatchObject({
      id: expenseId,
      description: "Power",
      amountCents: 1001,
      payerId: payer,
      spentOn: "2026-11-03",
      settled: false,
    });
    expect(edited.editedAt).not.toBeNull();
    expect(edited.shares).toEqual(
      expect.arrayContaining([
        { userId: payer, shareCents: 501 },
        { userId: second, shareCents: 500 },
      ]),
    );
    expect(edited.shares).toHaveLength(2);
  });

  it("changes every affected member's share when the amount changes", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense(3);

    const edited = await editExpense(
      memberIds[0],
      groupId,
      expenseId,
      edit(memberIds, { amountCents: 3000 }),
    );

    expect(edited.shares.map((s) => s.shareCents)).toEqual([1000, 1000, 1000]);
  });

  it("ignores a payer id in the request, so the payer stays the same", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    const [payer, second] = memberIds;

    // The service's type has no payerId; this is what a raw request carries
    // past the schema if the route ever stopped dropping it.
    const withPayer = { ...edit([payer, second]), payerId: second };
    const edited = await editExpense(
      payer,
      groupId,
      expenseId,
      withPayer as unknown as UpdateExpenseInput,
    );

    expect(edited.payerId).toBe(payer);
  });

  it("rejects an edit whose sharers leave the payer out, and changes nothing", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    const [payer, second, third] = memberIds;

    await expect(
      editExpense(payer, groupId, expenseId, edit([second, third])),
    ).rejects.toMatchObject({
      status: 400,
      fields: { sharedBy: expect.any(String) },
    });
    expect((await findExpense(expenseId))?.description).toBe("Electricity");
  });

  it("rejects custom amounts that don't add up, and changes nothing", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    const [payer, second] = memberIds;

    await expect(
      editExpense(payer, groupId, expenseId, {
        ...edit([payer, second], { amountCents: 3000 }),
        mode: "custom",
        amountsCents: { [payer]: 1000, [second]: 1000 },
      } as UpdateExpenseInput),
    ).rejects.toMatchObject({ status: 400 });
    const unchanged = await findExpense(expenseId);
    expect(unchanged?.amountCents).toBe(1234);
    expect(unchanged?.shares).toHaveLength(3);
  });

  it("refuses a non-payer with 403", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();

    await expect(
      editExpense(memberIds[1], groupId, expenseId, edit(memberIds)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses a settled expense with 409", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    await settle(groupId, memberIds[0], expenseId);

    await expect(
      editExpense(memberIds[0], groupId, expenseId, edit(memberIds)),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a former member with 403, even for their own expense", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    await leave(groupId, memberIds[0]);

    await expect(
      editExpense(memberIds[0], groupId, expenseId, edit([memberIds[0]])),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses an archived group with 403", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    await db
      .from("groups")
      .update({ archived_at: "2026-11-03T00:00:00Z" })
      .eq("id", groupId);

    await expect(
      editExpense(memberIds[0], groupId, expenseId, edit(memberIds)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("removeExpense", () => {
  it("lets the payer delete an unsettled expense, shares and all", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();

    await removeExpense(memberIds[0], groupId, expenseId);

    expect(await findExpense(expenseId)).toBeNull();
    const { data: shares } = await db
      .from("expense_shares")
      .select("user_id")
      .eq("expense_id", expenseId);
    expect(shares).toEqual([]);
  });

  it("leaves a list item the expense came from checked off, with no expense", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();
    const item = await db
      .from("list_items")
      .insert({
        group_id: groupId,
        title: "Milk",
        added_by: memberIds[0],
        status: "done",
        completed_by: memberIds[0],
        completed_at: DONE_AT,
        expense_id: expenseId,
      })
      .select("id")
      .single();
    if (item.error) {
      throw item.error;
    }

    await removeExpense(memberIds[0], groupId, expenseId);

    const { data } = await db
      .from("list_items")
      .select("status, expense_id")
      .eq("id", item.data.id)
      .single();
    expect(data).toEqual({ status: "done", expense_id: null });
  });

  it("refuses a non-payer with 403 and a settled expense with 409", async () => {
    const { groupId, memberIds, expenseId } = await groupWithExpense();

    await expect(
      removeExpense(memberIds[1], groupId, expenseId),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await settle(groupId, memberIds[0], expenseId);
    await expect(
      removeExpense(memberIds[0], groupId, expenseId),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await findExpense(expenseId)).not.toBeNull();
  });
});
