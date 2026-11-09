// start_settlement, cancel_settlement and confirm_payment (#19, AGENTS.md
// Section 6.10): a settle-up is a snapshot with suggested payments, one open
// per group; cancelling is only possible while every payment is suggested;
// confirming the last payment closes the period and locks its rows.
import { afterAll, describe, expect, it } from "vitest";
import { anonDb, cleanUp, createGroupWithMembers, db } from "./fixtures";

afterAll(cleanUp);

type Suggested = {
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
};

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

// The balances the payments clear: what start_settlement checks against the
// database as of the cut-off (#86). Every group here has balances that its
// suggested payments settle exactly.
function balancesCleared(payments: Suggested[]) {
  const cents = new Map<string, number>();
  for (const payment of payments) {
    cents.set(
      payment.from_user_id,
      (cents.get(payment.from_user_id) ?? 0) - payment.amount_cents,
    );
    cents.set(
      payment.to_user_id,
      (cents.get(payment.to_user_id) ?? 0) + payment.amount_cents,
    );
  }
  return Array.from(cents, ([user_id, balance_cents]) => ({
    user_id,
    balance_cents,
  }));
}

async function start(
  groupId: string,
  startedBy: string,
  payments: Suggested[],
) {
  const { data: now, error } = await db.rpc("db_now");
  if (error) {
    throw error;
  }
  return db.rpc("start_settlement", {
    p_group_id: groupId,
    p_started_by: startedBy,
    p_started_at: now as string,
    p_balances: balancesCleared(payments),
    p_payments: payments,
  });
}

async function started(
  groupId: string,
  startedBy: string,
  payments: Suggested[],
): Promise<string> {
  const { data, error } = await start(groupId, startedBy, payments);
  if (error) {
    throw error;
  }
  return data as string;
}

async function settlementRow(id: string) {
  const { data } = await db
    .from("settlements")
    .select("status, started_at, closed_at")
    .eq("id", id)
    .single();
  return data!;
}

async function paymentsOf(settlementId: string) {
  const { data } = await db
    .from("payments")
    .select("id, from_user_id, to_user_id, amount_cents, status, paid_at")
    .eq("settlement_id", settlementId)
    .order("amount_cents");
  return data!;
}

// paid_at comes from the database's clock, like confirm_payment's
// confirmed_at, so a Docker VM clock behind the host's can't break
// payments_confirmed_after_paid (#121).
async function markPaid(paymentId: string) {
  const { data: paidAt } = await db.rpc("db_now");
  const { error } = await db
    .from("payments")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", paymentId);
  if (error) {
    throw error;
  }
}

// Two members: the first paid $30 for both, so the second owes $15.
async function groupWithDebt() {
  const { groupId, memberIds } = await createGroupWithMembers(2);
  const expenseId = await addExpense(groupId, memberIds[0], memberIds, 3000);
  const payment = {
    from_user_id: memberIds[1],
    to_user_id: memberIds[0],
    amount_cents: 1500,
  };
  return { groupId, memberIds, expenseId, payment };
}

describe("start_settlement", () => {
  it("creates an open settlement with its suggested payments", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();

    const settlementId = await started(groupId, memberIds[0], [payment]);

    const settlement = await settlementRow(settlementId);
    expect(settlement.status).toBe("open");
    expect(settlement.closed_at).toBeNull();
    const payments = await paymentsOf(settlementId);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ ...payment, status: "suggested" });
  });

  it("refuses a second settle-up while one is open", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();
    await started(groupId, memberIds[0], [payment]);

    const { error } = await start(groupId, memberIds[1], [payment]);

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/already open/);
  });

  it("closes at once when there is nothing to pay, locking the period", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    // Each paid $10 for both: everyone is settled up.
    const first = await addExpense(groupId, memberIds[0], memberIds, 1000);
    const second = await addExpense(groupId, memberIds[1], memberIds, 1000);

    const settlementId = await started(groupId, memberIds[0], []);

    expect((await settlementRow(settlementId)).status).toBe("closed");
    const { data } = await db
      .from("expenses")
      .select("id, settlement_id")
      .in("id", [first, second]);
    expect(data!.map((row) => row.settlement_id)).toEqual([
      settlementId,
      settlementId,
    ]);
  });

  it("can be started again after a cancelled one", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();
    const first = await started(groupId, memberIds[0], [payment]);
    const { error } = await db.rpc("cancel_settlement", {
      p_group_id: groupId,
    });
    expect(error).toBeNull();

    const second = await started(groupId, memberIds[1], [payment]);

    expect(second).not.toBe(first);
    expect((await settlementRow(second)).status).toBe("open");
  });

  it("is not callable by the browser", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();

    const { error } = await anonDb().rpc("start_settlement", {
      p_group_id: groupId,
      p_started_by: memberIds[0],
      p_started_at: new Date().toISOString(),
      p_balances: [],
      p_payments: [payment],
    });

    expect(error?.code).toBe("42501");
  });
});

describe("cancel_settlement", () => {
  it("deletes the suggested payments and leaves the expenses unsettled", async () => {
    const { groupId, memberIds, expenseId, payment } = await groupWithDebt();
    const settlementId = await started(groupId, memberIds[0], [payment]);

    const { error } = await db.rpc("cancel_settlement", {
      p_group_id: groupId,
    });

    expect(error).toBeNull();
    const settlement = await settlementRow(settlementId);
    expect(settlement.status).toBe("cancelled");
    expect(settlement.closed_at).not.toBeNull();
    expect(await paymentsOf(settlementId)).toEqual([]);
    const { data } = await db
      .from("expenses")
      .select("settlement_id")
      .eq("id", expenseId)
      .single();
    expect(data!.settlement_id).toBeNull();
  });

  it("is a conflict once a payment is marked paid", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();
    const settlementId = await started(groupId, memberIds[0], [payment]);
    const [suggested] = await paymentsOf(settlementId);
    await markPaid(suggested.id);

    const { error } = await db.rpc("cancel_settlement", {
      p_group_id: groupId,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/marked paid/);
    expect((await settlementRow(settlementId)).status).toBe("open");
  });

  it("finds nothing to cancel without an open settle-up", async () => {
    const { groupId } = await createGroupWithMembers(2);

    const { error } = await db.rpc("cancel_settlement", {
      p_group_id: groupId,
    });

    expect(error?.code).toBe("P0002");
  });
});

describe("confirm_payment", () => {
  it("confirms a paid payment and closes the period with the last one", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    // The first member paid $30 for all three: the others owe $10 each.
    const expenseId = await addExpense(groupId, memberIds[0], memberIds, 3000);
    const settlementId = await started(groupId, memberIds[0], [
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
    ]);
    const [first, second] = await paymentsOf(settlementId);
    await markPaid(first.id);
    await markPaid(second.id);

    const one = await db.rpc("confirm_payment", { p_payment_id: first.id });
    expect(one.error).toBeNull();
    expect(one.data).toBe(false);
    expect((await settlementRow(settlementId)).status).toBe("open");

    const two = await db.rpc("confirm_payment", { p_payment_id: second.id });
    expect(two.error).toBeNull();
    expect(two.data).toBe(true);

    const settlement = await settlementRow(settlementId);
    expect(settlement.status).toBe("closed");
    expect(settlement.closed_at).not.toBeNull();
    const payments = await paymentsOf(settlementId);
    expect(payments.map((row) => row.status)).toEqual([
      "confirmed",
      "confirmed",
    ]);
    const { data: expense } = await db
      .from("expenses")
      .select("settlement_id")
      .eq("id", expenseId)
      .single();
    expect(expense!.settlement_id).toBe(settlementId);
  });

  it("leaves expenses added after the start in the next period", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();
    const settlementId = await started(groupId, memberIds[0], [payment]);
    const later = await addExpense(groupId, memberIds[1], memberIds, 800);
    const [suggested] = await paymentsOf(settlementId);
    await markPaid(suggested.id);

    const { error } = await db.rpc("confirm_payment", {
      p_payment_id: suggested.id,
    });

    expect(error).toBeNull();
    const { data } = await db
      .from("expenses")
      .select("settlement_id")
      .eq("id", later)
      .single();
    expect(data!.settlement_id).toBeNull();
  });

  it("locks a direct payment confirmed before the start, not one after", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();
    const direct = (confirmedAt: string) =>
      db
        .from("payments")
        .insert({
          group_id: groupId,
          from_user_id: memberIds[1],
          to_user_id: memberIds[0],
          amount_cents: 100,
          status: "confirmed",
          paid_at: confirmedAt,
          confirmed_at: confirmedAt,
        })
        .select("id")
        .single();
    const before = await direct(new Date(Date.now() - 60_000).toISOString());
    const settlementId = await started(groupId, memberIds[0], [
      { ...payment, amount_cents: 1400 },
    ]);
    const after = await direct(new Date(Date.now() + 60_000).toISOString());
    const [suggested] = await paymentsOf(settlementId);
    await markPaid(suggested.id);

    await db.rpc("confirm_payment", { p_payment_id: suggested.id });

    const { data } = await db
      .from("payments")
      .select("id, settlement_id")
      .in("id", [before.data!.id, after.data!.id]);
    const byId = Object.fromEntries(
      data!.map((row) => [row.id, row.settlement_id]),
    );
    expect(byId[before.data!.id]).toBe(settlementId);
    expect(byId[after.data!.id]).toBeNull();
  });

  it("is a conflict for a payment that isn't marked paid", async () => {
    const { groupId, memberIds, payment } = await groupWithDebt();
    const settlementId = await started(groupId, memberIds[0], [payment]);
    const [suggested] = await paymentsOf(settlementId);

    const { error } = await db.rpc("confirm_payment", {
      p_payment_id: suggested.id,
    });

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/marked paid/);
  });

  it("finds nothing for an unknown payment", async () => {
    const { error } = await db.rpc("confirm_payment", {
      p_payment_id: "00000000-0000-4000-8000-000000000000",
    });

    expect(error?.code).toBe("P0002");
  });
});
