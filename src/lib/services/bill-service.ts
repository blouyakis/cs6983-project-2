import "server-only";
import { listExpensesInPeriod, type Expense } from "@/lib/db/expenses";
import { listMembersAt } from "@/lib/db/group-members";
import {
  listClosedPeriodConfirmedPayments,
  listPeriodConfirmedPayments,
} from "@/lib/db/periods";
import {
  findOpenSettlement,
  listClosedSettlements,
  type ClosedPeriod,
} from "@/lib/db/settlements";
import { owedToEach, sharedBy, type OwedToMember } from "@/lib/domain/bill";
import { NotFoundError } from "@/lib/http/errors";
import { requireGroupAccess } from "./access";

export type { OwedToMember };

// One expense on the bill, with the user's part of it.
export type BillLine = Expense & { shareCents: number };

export type Bill = {
  // The closed settle-up this bill is for, or null for the current period.
  settlementId: string | null;
  // The closed periods the user can look back at, newest first.
  pastPeriods: ClosedPeriod[];
  // The expenses the user shares, newest first.
  lines: BillLine[];
  // What the user owes each other member over the period, in the order they
  // joined. Adds up to minus the user's balance (AGENTS.md Section 6.4).
  owed: OwedToMember[];
};

// The session user's itemized bill for a group (#21, user flow 7): the
// current period by default, or a closed one. Every member can see every
// expense (PRD "Bills"); the bill narrows that to the user's own. A former
// member's bill stops at the day they left (Section 6.6).
export async function getMyBill(
  userId: string,
  groupId: string,
  settlementId: string | null = null,
): Promise<Bill> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  const pastPeriods = await listClosedSettlements(groupId, readUntil);
  if (
    settlementId !== null &&
    !pastPeriods.some((period) => period.id === settlementId)
  ) {
    // An open, cancelled or unknown settle-up, or another group's.
    throw new NotFoundError("This period doesn't exist.");
  }

  let expenses: Expense[];
  let payments;
  if (settlementId === null) {
    const openSettlementId = (await findOpenSettlement(groupId))?.id ?? null;
    [expenses, payments] = await Promise.all([
      listExpensesInPeriod(groupId, { openSettlementId }, readUntil),
      listPeriodConfirmedPayments(groupId, openSettlementId, readUntil),
    ]);
  } else {
    [expenses, payments] = await Promise.all([
      listExpensesInPeriod(groupId, { settlementId }, readUntil),
      listClosedPeriodConfirmedPayments(groupId, settlementId),
    ]);
  }
  const members = await listMembersAt(groupId, readUntil);

  const lines = sharedBy(userId, expenses).map((expense) => ({
    ...expense,
    shareCents:
      expense.shares.find((share) => share.userId === userId)?.shareCents ?? 0,
  }));
  const owed = owedToEach(
    userId,
    members.map((member) => member.userId),
    expenses,
    payments,
  );
  return { settlementId, pastPeriods, lines, owed };
}
