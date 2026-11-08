// Why an expense can't be changed or deleted right now (AGENTS.md Section
// 6.7): a settle-up has claimed it, or it was created on or before the start
// of the group's open settle-up, which freezes it until the period closes or
// the settle-up is cancelled (#86). Null when it can still change.
export type ExpenseLock = "settled" | "settle-up";

type LockableExpense = {
  settled: boolean;
  createdAt: string;
};

// Timestamps come from Postgres in one format, so they compare as strings, as
// in ExpenseList.
export function expenseLock(
  expense: LockableExpense,
  openSettleUpStartedAt: string | null,
): ExpenseLock | null {
  if (expense.settled) {
    return "settled";
  }
  if (
    openSettleUpStartedAt !== null &&
    expense.createdAt <= openSettleUpStartedAt
  ) {
    return "settle-up";
  }
  return null;
}
