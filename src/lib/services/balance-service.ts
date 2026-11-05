import "server-only";
import { listMembersAt } from "@/lib/db/group-members";
import {
  findOpenSettlementId,
  listPeriodConfirmedPayments,
  listPeriodExpenses,
} from "@/lib/db/periods";
import { computeBalances, type Balance } from "@/lib/domain/balances";
import { requireGroupAccess } from "./access";

export type { Balance };

// Each member's balance for the current period (AGENTS.md Section 6.4).
// Balances are never stored: every request recomputes them from the
// period's expenses and confirmed payments, so a changed expense shows on
// the next request. A former member sees the balances as they were when
// they left (Section 6.6).
export async function getGroupBalances(
  userId: string,
  groupId: string,
): Promise<Balance[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  const openSettlementId = await findOpenSettlementId(groupId);
  const [members, expenses, payments] = await Promise.all([
    listMembersAt(groupId, readUntil),
    listPeriodExpenses(groupId, openSettlementId, readUntil),
    listPeriodConfirmedPayments(groupId, openSettlementId, readUntil),
  ]);
  return computeBalances(
    members.map((member) => member.userId),
    expenses,
    payments,
  );
}
