import { expenseLock } from "./expense-lock";
import type { Share } from "./splits";

// The expense history on the overview (#15, DESIGN.md "ExpenseTable"): every
// expense the user shares, across their groups and personal space, newest
// first. Everything is integer cents (AGENTS.md Section 6.1).

type HistoryExpense = {
  id: string;
  payerId: string;
  // A calendar day, such as "2026-10-20".
  spentOn: string;
  settled: boolean;
  createdAt: string;
  shares: readonly Share[];
};

// One group's expenses, with what decides whether the user can edit them.
export type GroupExpenses<Expense extends HistoryExpense> = {
  groupId: string;
  groupName: string;
  isPersonal: boolean;
  // A group the user left, or an archived one: nothing in it can be edited.
  readOnly: boolean;
  // When a settle-up is open, its started_at (#86). Null otherwise.
  openSettleUpStartedAt: string | null;
  expenses: readonly Expense[];
};

// Why the Edit column shows a lock instead of a pencil. Only the payer can
// edit, and only while the expense is unsettled, outside an open settle-up
// and in a group they can still write to (AGENTS.md Section 6.7).
export type EditLock = "settled" | "not-payer" | "settle-up" | "read-only";

export type HistoryRow<Expense extends HistoryExpense> = Expense & {
  groupName: string;
  isPersonal: boolean;
  // The user's share of this expense. 0 when they paid it only for others.
  yourShareCents: number;
  // Null when the user can edit the expense, so the row gets a pencil.
  editLock: EditLock | null;
};

function editLockOf(
  userId: string,
  expense: HistoryExpense,
  group: { readOnly: boolean; openSettleUpStartedAt: string | null },
): EditLock | null {
  const lock = expenseLock(expense, group.openSettleUpStartedAt);
  if (lock === "settled") {
    return "settled";
  }
  if (expense.payerId !== userId) {
    return "not-payer";
  }
  if (lock === "settle-up") {
    return "settle-up";
  }
  return group.readOnly ? "read-only" : null;
}

// Newest day first and, within a day, newest entry first, as a group's own
// list is ordered. The id settles two entries from the same moment, so the
// order never depends on which group was read first.
function newestFirst(a: HistoryExpense, b: HistoryExpense): number {
  if (a.spentOn !== b.spentOn) {
    return a.spentOn < b.spentOn ? 1 : -1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }
  return a.id < b.id ? -1 : 1;
}

// The expenses the user has a share in, from every group given, as one list.
// An expense in the user's group that they don't share is left out; one they
// paid only for others has their share of 0 (Section 6.2), so it stays.
export function expenseHistory<Expense extends HistoryExpense>(
  userId: string,
  groups: readonly GroupExpenses<Expense>[],
): HistoryRow<Expense>[] {
  const rows: HistoryRow<Expense>[] = [];
  for (const group of groups) {
    for (const expense of group.expenses) {
      const own = expense.shares.find((share) => share.userId === userId);
      if (!own) {
        continue;
      }
      rows.push({
        ...expense,
        groupName: group.groupName,
        isPersonal: group.isPersonal,
        yourShareCents: own.shareCents,
        editLock: editLockOf(userId, expense, group),
      });
    }
  }
  return rows.sort(newestFirst);
}
