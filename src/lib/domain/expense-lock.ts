// Why an expense can't be changed or deleted right now (AGENTS.md Section
// 6.7): a settle-up has claimed it; it was created on or before the start of
// the group's open settle-up, which freezes it until the period closes or the
// settle-up is cancelled (#86); or someone who has left the group has a
// non-zero share in it, and keeps the balance they left with until a
// settle-up claims it (#22). Null when it can still change.
export type ExpenseLock = "settled" | "settle-up" | "member-left";

type LockableExpense = {
  settled: boolean;
  createdAt: string;
  shares: readonly { userId: string; shareCents: number }[];
};

// Timestamps come from Postgres in one format, so they compare as strings, as
// in ExpenseList. The settle-up locks come first: they last at least as long
// as a former member's share does.
export function expenseLock(
  expense: LockableExpense,
  openSettleUpStartedAt: string | null,
  currentMemberIds: ReadonlySet<string>,
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
  if (
    expense.shares.some(
      (share) => share.shareCents !== 0 && !currentMemberIds.has(share.userId),
    )
  ) {
    return "member-left";
  }
  return null;
}
