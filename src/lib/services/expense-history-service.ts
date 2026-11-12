import "server-only";
import { listExpenses, type Expense } from "@/lib/db/expenses";
import { findOpenSettlement } from "@/lib/db/settlements";
import {
  expenseHistory,
  FORMER_PAYER,
  paidByFormerMember,
  type GroupExpenses,
  type HistoryRow,
} from "@/lib/domain/expense-history";
import type { ExpenseHistoryFilters } from "@/lib/validation/expense";
import { requireGroupAccess } from "./access";
import { listGroups, type GroupSummary } from "./group-service";

// One row of the expense history: an expense the user shares, with its
// group's name, the user's share, and why it can or can't be edited.
export type ExpenseHistoryRow = HistoryRow<Expense>;

// One group's part of the history. Access is checked for every group
// (AGENTS.md Section 6.6), and a former member only gets what was added
// before they left. The open settle-up only matters where the user could
// still edit, so a read-only group and the personal space, which is never
// settled, don't ask for it. "former" as the payer (#130) means anyone who
// has left this group, which the database can't answer with one id, so every
// payer is read and the group's own members narrow the list.
async function groupExpenses(
  userId: string,
  group: GroupSummary,
  filters: ExpenseHistoryFilters,
): Promise<GroupExpenses<Expense>> {
  const { readUntil } = await requireGroupAccess(userId, group.id, "read");
  const formerOnly = filters.paidBy === FORMER_PAYER;
  const currentMemberIds = new Set(
    group.members.map((member) => member.userId),
  );
  const [expenses, openSettleUp] = await Promise.all([
    listExpenses(group.id, readUntil, {
      paidBy: formerOnly ? undefined : filters.paidBy,
      from: filters.from,
      to: filters.to,
    }),
    group.readOnly || group.isPersonal ? null : findOpenSettlement(group.id),
  ]);
  return {
    groupId: group.id,
    groupName: group.name,
    isPersonal: group.isPersonal,
    readOnly: group.readOnly,
    openSettleUpStartedAt: openSettleUp?.startedAt ?? null,
    currentMemberIds,
    expenses: formerOnly
      ? expenses.filter((expense) =>
          paidByFormerMember(expense, currentMemberIds),
        )
      : expenses,
  };
}

// The session user's expense history (#15, user story 1): every expense they
// share, across their groups and personal space, newest first, narrowed by
// group, who paid, and the days from and to. Groups they left are included up
// to the day they left. A `groupId` the user was never in is 403, like every
// other read of a group; expenses of other groups are never read at all.
export async function listExpenseHistory(
  userId: string,
  filters: ExpenseHistoryFilters = {},
): Promise<ExpenseHistoryRow[]> {
  if (filters.groupId !== undefined) {
    await requireGroupAccess(userId, filters.groupId, "read");
  }
  const groups = (await listGroups(userId)).filter(
    (group) => filters.groupId === undefined || group.id === filters.groupId,
  );
  return expenseHistory(
    userId,
    await Promise.all(
      groups.map((group) => groupExpenses(userId, group, filters)),
    ),
  );
}
