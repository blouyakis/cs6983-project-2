import "server-only";
import type { Balance } from "@/lib/domain/balances";
import type { SuggestedPayment } from "@/lib/domain/settle-up";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import { getDb } from "./client";

// Settle-up periods and their payments (#19, AGENTS.md Section 6.10).
// Starting, cancelling and confirming write to several tables, so they are
// Postgres functions (settle_up migration). The services decide who may do
// what; this layer maps rows and the functions' error codes.

export type SettlementStatus = "open" | "closed" | "cancelled";
export type PaymentStatus = "suggested" | "paid" | "confirmed";

type SettlementRow = {
  id: string;
  group_id: string;
  status: SettlementStatus;
  started_by: string;
  started_at: string;
  closed_at: string | null;
};

export type Settlement = {
  id: string;
  groupId: string;
  status: SettlementStatus;
  startedBy: string;
  startedAt: string;
  closedAt: string | null;
};

export type ClosedPeriod = Settlement & {
  expenseCount: number;
  paymentCount: number;
};

type PaymentRow = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  status: PaymentStatus;
  settlement_id: string | null;
  created_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
};

export type Payment = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  status: PaymentStatus;
  // The settle-up that suggested it, or that closed over a direct payment.
  settlementId: string | null;
  createdAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
};

const SETTLEMENT_COLUMNS =
  "id, group_id, status, started_by, started_at, closed_at";
const PAYMENT_COLUMNS =
  "id, group_id, from_user_id, to_user_id, amount_cents, status, settlement_id, created_at, paid_at, confirmed_at";

// raise_exception and no_data_found, the two codes the functions use.
const CONFLICT_CODE = "P0001";
const NOT_FOUND_CODE = "P0002";
// check_violation: a row the table's own checks refuse.
const CHECK_CODE = "23514";

function toSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    groupId: row.group_id,
    status: row.status,
    startedBy: row.started_by,
    startedAt: row.started_at,
    closedAt: row.closed_at,
  };
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    groupId: row.group_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amountCents: row.amount_cents,
    status: row.status,
    settlementId: row.settlement_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    confirmedAt: row.confirmed_at,
  };
}

// The database's clock, for a cut-off every later check agrees on (#86).
export async function dbNow(): Promise<string> {
  const { data, error } = await getDb().rpc("db_now", {});
  if (error) {
    throw new Error(`Could not read the database clock: ${error.message}`);
  }
  return data as string;
}

// start_settlement refused the balances: a cost landed before the cut-off
// after the service read them. The service reads again from a new cut-off.
export class BalancesChangedError extends ConflictError {}

const BALANCES_CHANGED = /balances changed/i;

// Starts a settle-up at `startedAt`, the cut-off the balances were read at,
// with the payments lib/domain suggested from them. The function locks the
// group, checks the balances against its own as of the cut-off, and stores
// the cut-off as started_at, so the period's rows and the suggestions agree
// (#86). The second of two members starting at once gets the conflict.
export async function insertSettlement(
  groupId: string,
  startedBy: string,
  startedAt: string,
  balances: readonly Balance[],
  payments: readonly SuggestedPayment[],
): Promise<string> {
  const { data, error } = await getDb().rpc("start_settlement", {
    p_group_id: groupId,
    p_started_by: startedBy,
    p_started_at: startedAt,
    p_balances: balances.map((balance) => ({
      user_id: balance.userId,
      balance_cents: balance.balanceCents,
    })),
    p_payments: payments.map((payment) => ({
      from_user_id: payment.fromUserId,
      to_user_id: payment.toUserId,
      amount_cents: payment.amountCents,
    })),
  });
  if (error) {
    if (error.code === CONFLICT_CODE && BALANCES_CHANGED.test(error.message)) {
      throw new BalancesChangedError(error.message);
    }
    if (error.code === CONFLICT_CODE) {
      throw new ConflictError(error.message);
    }
    throw new Error(`Could not start the settle-up: ${error.message}`);
  }
  return data as string;
}

export async function findOpenSettlement(
  groupId: string,
): Promise<Settlement | null> {
  const { data, error } = await getDb()
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("group_id", groupId)
    .eq("status", "open")
    .maybeSingle<SettlementRow>();
  if (error) {
    throw new Error(`Could not load the open settle-up: ${error.message}`);
  }
  return data ? toSettlement(data) : null;
}

export async function findSettlement(
  settlementId: string,
): Promise<Settlement | null> {
  const { data, error } = await getDb()
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("id", settlementId)
    .maybeSingle<SettlementRow>();
  if (error) {
    throw new Error(`Could not load the settle-up: ${error.message}`);
  }
  return data ? toSettlement(data) : null;
}

export async function listSettlementPayments(
  settlementId: string,
): Promise<Payment[]> {
  const { data, error } = await getDb()
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `Could not load the settle-up's payments: ${error.message}`,
    );
  }
  return (data as PaymentRow[]).map(toPayment);
}

// Counts rows whose settlement_id is one of the given ids.
async function countBySettlement(
  table: "expenses" | "payments",
  settlementIds: string[],
): Promise<Map<string, number>> {
  const { data, error } = await getDb()
    .from(table)
    .select("settlement_id")
    .in("settlement_id", settlementIds);
  if (error) {
    throw new Error(`Could not count the period's ${table}: ${error.message}`);
  }
  const counts = new Map<string, number>();
  for (const row of data as { settlement_id: string }[]) {
    counts.set(row.settlement_id, (counts.get(row.settlement_id) ?? 0) + 1);
  }
  return counts;
}

// Closed periods, newest first, with how many expenses and payments each one
// settled (DESIGN.md "PastPeriods"). `startedBefore` is a former member's
// left_at: they only see periods started before they left (Section 6.6).
export async function listClosedSettlements(
  groupId: string,
  startedBefore: string | null,
): Promise<ClosedPeriod[]> {
  let query = getDb()
    .from("settlements")
    .select(SETTLEMENT_COLUMNS)
    .eq("group_id", groupId)
    .eq("status", "closed");
  if (startedBefore !== null) {
    query = query.lte("started_at", startedBefore);
  }
  const { data, error } = await query.order("closed_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load the past periods: ${error.message}`);
  }
  const settlements = (data as SettlementRow[]).map(toSettlement);
  if (settlements.length === 0) {
    return [];
  }
  const ids = settlements.map((settlement) => settlement.id);
  const expenseCounts = await countBySettlement("expenses", ids);
  const paymentCounts = await countBySettlement("payments", ids);
  return settlements.map((settlement) => ({
    ...settlement,
    expenseCount: expenseCounts.get(settlement.id) ?? 0,
    paymentCount: paymentCounts.get(settlement.id) ?? 0,
  }));
}

// Cancels the group's open settle-up while every payment is still suggested.
export async function cancelOpenSettlement(groupId: string): Promise<void> {
  const { error } = await getDb().rpc("cancel_settlement", {
    p_group_id: groupId,
  });
  if (error) {
    if (error.code === NOT_FOUND_CODE) {
      throw new NotFoundError("There is no open settle-up to cancel.");
    }
    if (error.code === CONFLICT_CODE) {
      throw new ConflictError(
        "A payment has been marked paid, so the settle-up can only close.",
      );
    }
    throw new Error(`Could not cancel the settle-up: ${error.message}`);
  }
}

export async function findPayment(paymentId: string): Promise<Payment | null> {
  const { data, error } = await getDb()
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("id", paymentId)
    .maybeSingle<PaymentRow>();
  if (error) {
    throw new Error(`Could not load the payment: ${error.message}`);
  }
  return data ? toPayment(data) : null;
}

// The status check is part of the update, so a payment confirmed or paid
// between the service's check and this write is left alone: null then.
// paid_at comes from the database's clock, the one confirm_payment stamps
// confirmed_at with, so confirmed_at is never earlier than paid_at even when
// the app server's clock runs ahead (#121).
export async function markPaymentPaid(
  paymentId: string,
): Promise<Payment | null> {
  const paidAt = await dbNow();
  const { data, error } = await getDb()
    .from("payments")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", paymentId)
    .eq("status", "suggested")
    .select(PAYMENT_COLUMNS)
    .maybeSingle<PaymentRow>();
  if (error) {
    throw new Error(`Could not mark the payment paid: ${error.message}`);
  }
  return data ? toPayment(data) : null;
}

// Confirms a paid payment. True when it was the last one of an open settle-up,
// which the function then closed in the same transaction.
export async function confirmPayment(paymentId: string): Promise<boolean> {
  const { data, error } = await getDb().rpc("confirm_payment", {
    p_payment_id: paymentId,
  });
  if (error) {
    if (error.code === NOT_FOUND_CODE) {
      throw new NotFoundError("This payment doesn't exist.");
    }
    if (error.code === CONFLICT_CODE) {
      throw new ConflictError("Only a payment marked paid can be confirmed.");
    }
    throw new Error(`Could not confirm the payment: ${error.message}`);
  }
  return data === true;
}

// #108: the recipient says the money of a paid settle-up payment never
// arrived, so it goes back to suggested and the payer can mark it again. Only
// a payment that is still paid changes, so a confirm that landed first wins
// and this returns null.
export async function unmarkPaymentPaid(
  paymentId: string,
): Promise<Payment | null> {
  const { data, error } = await getDb()
    .from("payments")
    .update({ status: "suggested", paid_at: null })
    .eq("id", paymentId)
    .eq("status", "paid")
    .not("settlement_id", "is", null)
    .select(PAYMENT_COLUMNS)
    .maybeSingle<PaymentRow>();
  if (error) {
    throw new Error(`Could not decline the payment: ${error.message}`);
  }
  return data ? toPayment(data) : null;
}

// #108: a declined direct payment never counted in a balance, so it is
// deleted. False when it is no longer paid, because a confirm landed first.
export async function deleteDirectPayment(paymentId: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("status", "paid")
    .is("settlement_id", null)
    .select("id");
  if (error) {
    throw new Error(`Could not decline the payment: ${error.message}`);
  }
  return (data ?? []).length > 0;
}

// Records a direct payment (#14) through record_payment, which stamps paid_at
// with the database's clock. The service has already checked both people; the
// function checks again under a lock, so a leave that landed in between is
// still refused here.
export async function recordPayment(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  amountCents: number,
): Promise<Payment> {
  const { data, error } = await getDb().rpc("record_payment", {
    p_group_id: groupId,
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
    p_amount_cents: amountCents,
  });
  if (error) {
    if (error.code === CONFLICT_CODE) {
      if (error.hint === "recipient_not_member") {
        throw new ValidationError("Check the highlighted fields.", {
          toUserId: "Choose a current member of this group.",
        });
      }
      throw new ForbiddenError("You're no longer a member of this group.");
    }
    if (error.code === CHECK_CODE) {
      throw new ValidationError("This payment isn't valid.");
    }
    throw new Error(`Could not record the payment: ${error.message}`);
  }
  const recorded = await findPayment(data as string);
  if (!recorded) {
    throw new Error("The recorded payment could not be loaded.");
  }
  return recorded;
}

// The group's payments that someone has sent (#14): paid or confirmed, direct
// or from a settle-up, last paid first. A suggested payment is only a plan and
// lives on the settle-up page. `createdBefore` is a former member's left_at,
// as in listExpenses.
export async function listGroupPayments(
  groupId: string,
  createdBefore: string | null,
): Promise<Payment[]> {
  let query = getDb()
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("group_id", groupId)
    .neq("status", "suggested");
  if (createdBefore !== null) {
    query = query.lte("created_at", createdBefore);
  }
  const { data, error } = await query.order("paid_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load the group's payments: ${error.message}`);
  }
  return (data as PaymentRow[]).map(toPayment);
}
