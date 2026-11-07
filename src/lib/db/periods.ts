import "server-only";
import type { BalanceExpense, ConfirmedPayment } from "@/lib/domain/balances";
import { getDb } from "./client";

// The current period of a group (architecture.md Section 6): expenses and
// payments whose settlement_id is null or points to the open settlement. A
// closed or cancelled settlement's rows belong to the past.

type SettlementRow = { id: string };

type PeriodExpenseRow = {
  payer_id: string;
  amount_cents: number;
  expense_shares: { user_id: string; share_cents: number }[];
};

type PaymentRow = {
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
};

export async function findOpenSettlementId(
  groupId: string,
): Promise<string | null> {
  const { data, error } = await getDb()
    .from("settlements")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "open")
    .maybeSingle<SettlementRow>();
  if (error) {
    throw new Error(`Could not load the open settle-up: ${error.message}`);
  }
  return data?.id ?? null;
}

// Which of the groups asked about have an open settle-up, for "Settle-up in
// progress" on the Settle up page (#68).
export async function findOpenSettlementGroupIds(
  groupIds: readonly string[],
): Promise<Set<string>> {
  if (groupIds.length === 0) {
    return new Set();
  }
  const { data, error } = await getDb()
    .from("settlements")
    .select("group_id")
    .in("group_id", groupIds)
    .eq("status", "open");
  if (error) {
    throw new Error(`Could not load open settlements: ${error.message}`);
  }
  return new Set((data as { group_id: string }[]).map((row) => row.group_id));
}

// Narrows a query to the current period. PostgREST's `or` takes one filter
// string; without an open settlement a plain null check reads better.
function inPeriod<Query extends PeriodFilters>(
  query: Query,
  openSettlementId: string | null,
): Query {
  return openSettlementId === null
    ? (query.is("settlement_id", null) as Query)
    : (query.or(
        `settlement_id.is.null,settlement_id.eq.${openSettlementId}`,
      ) as Query);
}

type PeriodFilters = {
  is(column: string, value: null): unknown;
  or(filters: string): unknown;
  lte(column: string, value: string): unknown;
};

// `createdBefore` is a former member's left_at, as in listExpenses: they only
// see what was added before they left (AGENTS.md Section 6.6).
function createdUpTo<Query extends PeriodFilters>(
  query: Query,
  createdBefore: string | null,
): Query {
  return createdBefore === null
    ? query
    : (query.lte("created_at", createdBefore) as Query);
}

// Only what the balance formula needs: payer, amount and shares.
export async function listPeriodExpenses(
  groupId: string,
  openSettlementId: string | null,
  createdBefore: string | null,
): Promise<BalanceExpense[]> {
  const query = getDb()
    .from("expenses")
    .select("payer_id, amount_cents, expense_shares(user_id, share_cents)")
    .eq("group_id", groupId);
  const { data, error } = await createdUpTo(
    inPeriod(query, openSettlementId),
    createdBefore,
  );
  if (error) {
    throw new Error(`Could not load the period's expenses: ${error.message}`);
  }
  return (data as unknown as PeriodExpenseRow[]).map((row) => ({
    payerId: row.payer_id,
    amountCents: row.amount_cents,
    shares: row.expense_shares.map((share) => ({
      userId: share.user_id,
      shareCents: share.share_cents,
    })),
  }));
}

// Only confirmed payments count (AGENTS.md Section 6.4): a suggested or paid
// one is still waiting on the recipient.
// `confirmedBefore` is a settle-up's cut-off (#86): only payments confirmed
// by then count, which is what close_settlement will lock into the period.
export async function listPeriodConfirmedPayments(
  groupId: string,
  openSettlementId: string | null,
  createdBefore: string | null,
  confirmedBefore: string | null = null,
): Promise<ConfirmedPayment[]> {
  let query = getDb()
    .from("payments")
    .select("from_user_id, to_user_id, amount_cents")
    .eq("group_id", groupId)
    .eq("status", "confirmed");
  if (confirmedBefore !== null) {
    query = query.lte("confirmed_at", confirmedBefore);
  }
  const { data, error } = await createdUpTo(
    inPeriod(query, openSettlementId),
    createdBefore,
  );
  if (error) {
    throw new Error(`Could not load the period's payments: ${error.message}`);
  }
  return (data as unknown as PaymentRow[]).map((row) => ({
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amountCents: row.amount_cents,
  }));
}
