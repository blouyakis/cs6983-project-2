// The settle-up follow-up (#86): start_settlement checks the balances it is
// given against the database as of its started_at, cancel_settlement and
// confirm_payment lock what they check, update_expense and delete_expense
// refuse an expense in an open settle-up, and the outcomes of the races in
// #82's review are pinned down. True interleaving can't be driven through
// PostgREST (each request is its own transaction), so these test the states
// each race ends in, and the locks are reviewed in the migration.
import { afterAll, describe, expect, it } from "vitest";
import { anonDb, cleanUp, createGroupWithMembers, db, dbNow } from "./fixtures";

afterAll(cleanUp);

type Suggested = {
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
};
type Balance = { user_id: string; balance_cents: number };

async function addExpense(
  groupId: string,
  payerId: string,
  sharerIds: string[],
  amountCents: number,
) {
  const each = amountCents / sharerIds.length;
  const { data, error } = await db.rpc("create_expense", {
    p_group_id: groupId,
    p_description: "Groceries",
    p_amount_cents: amountCents,
    p_payer_id: payerId,
    p_spent_on: "2026-10-20",
    p_shares: sharerIds.map((id) => ({ user_id: id, share_cents: each })),
  });
  if (error) {
    throw error;
  }
  return data as string;
}

function start(
  groupId: string,
  startedBy: string,
  startedAt: string,
  balances: Balance[],
  payments: Suggested[],
) {
  return db.rpc("start_settlement", {
    p_group_id: groupId,
    p_started_by: startedBy,
    p_started_at: startedAt,
    p_balances: balances,
    p_payments: payments,
  });
}

async function paymentsOf(settlementId: string) {
  const { data } = await db
    .from("payments")
    .select("id, status")
    .eq("settlement_id", settlementId)
    .order("amount_cents");
  return data!;
}

async function statusOf(settlementId: string) {
  const { data } = await db
    .from("settlements")
    .select("status")
    .eq("id", settlementId)
    .single();
  return data!.status as string;
}

// paid_at comes from the database's clock, like confirm_payment's
// confirmed_at, so a Docker VM clock behind the host's can't break
// payments_confirmed_after_paid (#121).
async function markPaid(paymentId: string) {
  const { error } = await db
    .from("payments")
    .update({ status: "paid", paid_at: await dbNow() })
    .eq("id", paymentId);
  if (error) {
    throw error;
  }
}

// Two members: the first paid $30 for both, so the second owes $15.
async function groupWithDebt() {
  const { groupId, memberIds } = await createGroupWithMembers(2);
  const expenseId = await addExpense(groupId, memberIds[0], memberIds, 3000);
  const balances = [
    { user_id: memberIds[0], balance_cents: 1500 },
    { user_id: memberIds[1], balance_cents: -1500 },
  ];
  const payment = {
    from_user_id: memberIds[1],
    to_user_id: memberIds[0],
    amount_cents: 1500,
  };
  return { groupId, memberIds, expenseId, balances, payment };
}

async function startedWithDebt() {
  const group = await groupWithDebt();
  const { data, error } = await start(
    group.groupId,
    group.memberIds[0],
    await dbNow(),
    group.balances,
    [group.payment],
  );
  if (error) {
    throw error;
  }
  return { ...group, settlementId: data as string };
}

describe("db_now", () => {
  it("gives the database's clock, for a cut-off every later check agrees on", async () => {
    const before = Date.now();
    const now = Date.parse(await dbNow());
    expect(Math.abs(now - before)).toBeLessThan(60_000);
  });

  it("is not callable by the browser", async () => {
    const { error } = await anonDb().rpc("db_now");
    expect(error?.code).toBe("42501");
  });
});

describe("start_settlement with a cut-off", () => {
  it("stores the cut-off as started_at when the balances match the database", async () => {
    const { groupId, memberIds, balances, payment } = await groupWithDebt();
    const startedAt = await dbNow();

    const { data, error } = await start(
      groupId,
      memberIds[0],
      startedAt,
      balances,
      [payment],
    );

    expect(error).toBeNull();
    const { data: settlement } = await db
      .from("settlements")
      .select("started_at")
      .eq("id", data as string)
      .single();
    expect(Date.parse(settlement!.started_at)).toBe(Date.parse(startedAt));
  });

  it("refuses balances that don't match the database at the cut-off, so a cost added in between is never settled unpaid", async () => {
    const { groupId, memberIds, balances, payment } = await groupWithDebt();
    // The service read the balances, then a cost landed before its cut-off.
    await addExpense(groupId, memberIds[1], memberIds, 1000);
    const startedAt = await dbNow();

    const { error } = await start(groupId, memberIds[0], startedAt, balances, [
      payment,
    ]);

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/changed/);
    const { data } = await db
      .from("settlements")
      .select("id")
      .eq("group_id", groupId);
    expect(data).toEqual([]);
  });

  it("ignores a cost added after the cut-off: it belongs to the next period", async () => {
    const { groupId, memberIds, balances, payment } = await groupWithDebt();
    const startedAt = await dbNow();
    const later = await addExpense(groupId, memberIds[1], memberIds, 1000);

    const { data, error } = await start(
      groupId,
      memberIds[0],
      startedAt,
      balances,
      [payment],
    );

    expect(error).toBeNull();
    const settlementId = data as string;
    const [suggested] = await paymentsOf(settlementId);
    await markPaid(suggested.id);
    await db.rpc("confirm_payment", { p_payment_id: suggested.id });
    const { data: expense } = await db
      .from("expenses")
      .select("settlement_id")
      .eq("id", later)
      .single();
    expect(expense!.settlement_id).toBeNull();
  });

  // #112, from the review of #126: confirm_payment locks only the payment's
  // row, not the group's, so a confirm can land after the service took its
  // cut-off. The payment is then no longer waiting, so the pending check
  // passes, and it isn't in the balances at the cut-off either, so those
  // match. Without this refusal the settle-up would suggest it a second time.
  it("refuses when a direct payment was confirmed after the cut-off, so the service reads the balances again", async () => {
    const { groupId, memberIds, balances, payment } = await groupWithDebt();
    const startedAt = await dbNow();
    const { data: paymentId, error: recordError } = await db.rpc(
      "record_payment",
      {
        p_group_id: groupId,
        p_from_user_id: payment.from_user_id,
        p_to_user_id: payment.to_user_id,
        p_amount_cents: payment.amount_cents,
      },
    );
    expect(recordError).toBeNull();
    const { error: confirmError } = await db.rpc("confirm_payment", {
      p_payment_id: paymentId,
    });
    expect(confirmError).toBeNull();

    const { error } = await start(groupId, memberIds[0], startedAt, balances, [
      payment,
    ]);

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/balances changed/i);
    const { data: none } = await db
      .from("settlements")
      .select("id")
      .eq("group_id", groupId);
    expect(none).toEqual([]);

    // From a fresh cut-off the payment counts, and nothing is left to pay.
    const { data: settlementId, error: retryError } = await start(
      groupId,
      memberIds[0],
      await dbNow(),
      [],
      [],
    );
    expect(retryError).toBeNull();
    expect(await statusOf(settlementId as string)).toBe("closed");
  });

  it("treats zero balances as absent, so members with nothing to pay need no row", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    await addExpense(groupId, memberIds[0], [memberIds[0], memberIds[1]], 2000);
    const startedAt = await dbNow();

    const { error } = await start(
      groupId,
      memberIds[0],
      startedAt,
      [
        { user_id: memberIds[0], balance_cents: 1000 },
        { user_id: memberIds[1], balance_cents: -1000 },
      ],
      [
        {
          from_user_id: memberIds[1],
          to_user_id: memberIds[0],
          amount_cents: 1000,
        },
      ],
    );

    expect(error).toBeNull();
  });

  it("refuses a cut-off in the future or older than a minute", async () => {
    const { groupId, memberIds, balances, payment } = await groupWithDebt();
    const now = Date.parse(await dbNow());

    const future = await start(
      groupId,
      memberIds[0],
      new Date(now + 5_000).toISOString(),
      balances,
      [payment],
    );
    expect(future.error?.code).toBe("P0001");
    expect(future.error?.message).toMatch(/cut-off/);

    const stale = await start(
      groupId,
      memberIds[0],
      new Date(now - 120_000).toISOString(),
      balances,
      [payment],
    );
    expect(stale.error?.code).toBe("P0001");
    expect(stale.error?.message).toMatch(/cut-off/);
  });
});

describe("confirm_payment", () => {
  it("closes the period once every payment is confirmed, whichever confirm comes last", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    await addExpense(groupId, memberIds[0], memberIds, 3000);
    const { data, error } = await start(
      groupId,
      memberIds[0],
      await dbNow(),
      [
        { user_id: memberIds[0], balance_cents: 2000 },
        { user_id: memberIds[1], balance_cents: -1000 },
        { user_id: memberIds[2], balance_cents: -1000 },
      ],
      [
        {
          from_user_id: memberIds[1],
          to_user_id: memberIds[0],
          amount_cents: 1000,
        },
        {
          from_user_id: memberIds[2],
          to_user_id: memberIds[0],
          amount_cents: 1000,
        },
      ],
    );
    expect(error).toBeNull();
    const settlementId = data as string;
    const [first, second] = await paymentsOf(settlementId);
    await markPaid(first.id);
    await markPaid(second.id);

    // Both confirms sent at once. With the settlement row locked, they run
    // one after the other, so exactly one of them closes the period.
    const results = await Promise.all([
      db.rpc("confirm_payment", { p_payment_id: first.id }),
      db.rpc("confirm_payment", { p_payment_id: second.id }),
    ]);

    expect(results.map((result) => result.error)).toEqual([null, null]);
    expect(results.map((result) => result.data).sort()).toEqual([false, true]);
    expect(await statusOf(settlementId)).toBe("closed");
  });
});

describe("cancel_settlement", () => {
  it("never deletes a payment that was marked paid, even when both land at once", async () => {
    const { groupId, settlementId } = await startedWithDebt();
    const [suggested] = await paymentsOf(settlementId);
    const paidAt = await dbNow();

    const [cancelled, paid] = await Promise.all([
      db.rpc("cancel_settlement", { p_group_id: groupId }),
      db
        .from("payments")
        .update({ status: "paid", paid_at: paidAt })
        .eq("id", suggested.id)
        .eq("status", "suggested")
        .select("id"),
    ]);

    // Either the cancel won (the payment is gone and the mark-paid found no
    // row) or the mark-paid won (the cancel was refused). Never both.
    const { data: rows } = await db
      .from("payments")
      .select("id, status")
      .eq("id", suggested.id);
    if (cancelled.error) {
      expect(cancelled.error.code).toBe("P0001");
      expect(rows).toEqual([{ id: suggested.id, status: "paid" }]);
      expect(await statusOf(settlementId)).toBe("open");
    } else {
      expect(paid.data).toEqual([]);
      expect(rows).toEqual([]);
      expect(await statusOf(settlementId)).toBe("cancelled");
    }
  });
});

describe("expenses in an open settle-up", () => {
  it("can't be edited until the period closes", async () => {
    const { groupId, memberIds, expenseId, settlementId } =
      await startedWithDebt();

    const { error } = await db.rpc("update_expense", {
      p_expense_id: expenseId,
      p_description: "Groceries",
      p_amount_cents: 1000,
      p_spent_on: "2026-10-20",
      p_shares: memberIds.map((id) => ({ user_id: id, share_cents: 500 })),
    });

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/settle-up/);
    const { data } = await db
      .from("expenses")
      .select("amount_cents")
      .eq("id", expenseId)
      .single();
    expect(data!.amount_cents).toBe(3000);
    expect(await statusOf(settlementId)).toBe("open");
    expect(groupId).toBeTruthy();
  });

  it("can't be deleted until the period closes", async () => {
    const { expenseId } = await startedWithDebt();

    const { error } = await db.rpc("delete_expense", {
      p_expense_id: expenseId,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/settle-up/);
    const { data } = await db.from("expenses").select("id").eq("id", expenseId);
    expect(data).toHaveLength(1);
  });

  it("can be edited and deleted again once the settle-up is cancelled", async () => {
    const { groupId, memberIds, expenseId } = await startedWithDebt();
    await db.rpc("cancel_settlement", { p_group_id: groupId });

    const edit = await db.rpc("update_expense", {
      p_expense_id: expenseId,
      p_description: "Groceries",
      p_amount_cents: 1000,
      p_spent_on: "2026-10-20",
      p_shares: memberIds.map((id) => ({ user_id: id, share_cents: 500 })),
    });
    expect(edit.error).toBeNull();

    const remove = await db.rpc("delete_expense", { p_expense_id: expenseId });
    expect(remove.error).toBeNull();
    const { data } = await db.from("expenses").select("id").eq("id", expenseId);
    expect(data).toEqual([]);
  });

  it("leaves a cost added after the start editable: it is the next period's", async () => {
    const { groupId, memberIds } = await startedWithDebt();
    const later = await addExpense(groupId, memberIds[1], memberIds, 1000);

    const { error } = await db.rpc("update_expense", {
      p_expense_id: later,
      p_description: "Groceries",
      p_amount_cents: 1200,
      p_spent_on: "2026-10-20",
      p_shares: memberIds.map((id) => ({ user_id: id, share_cents: 600 })),
    });

    expect(error).toBeNull();
  });
});

describe("delete_expense", () => {
  it("deletes an unsettled expense with its shares", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const expenseId = await addExpense(groupId, memberIds[0], memberIds, 3000);

    const { error } = await db.rpc("delete_expense", {
      p_expense_id: expenseId,
    });

    expect(error).toBeNull();
    const { data: shares } = await db
      .from("expense_shares")
      .select("expense_id")
      .eq("expense_id", expenseId);
    expect(shares).toEqual([]);
  });

  it("is a conflict for a settled expense and not found for an unknown one", async () => {
    const { expenseId, settlementId } = await startedWithDebt();
    const [suggested] = await paymentsOf(settlementId);
    await markPaid(suggested.id);
    await db.rpc("confirm_payment", { p_payment_id: suggested.id });
    expect(await statusOf(settlementId)).toBe("closed");

    const settled = await db.rpc("delete_expense", { p_expense_id: expenseId });
    expect(settled.error?.code).toBe("P0001");
    expect(settled.error?.message).toMatch(/settled/);

    const unknown = await db.rpc("delete_expense", {
      p_expense_id: "00000000-0000-4000-8000-000000000000",
    });
    expect(unknown.error?.code).toBe("P0002");
  });

  it("is not callable by the browser", async () => {
    const { error } = await anonDb().rpc("delete_expense", {
      p_expense_id: "00000000-0000-4000-8000-000000000000",
    });
    expect(error?.code).toBe("42501");
  });
});
