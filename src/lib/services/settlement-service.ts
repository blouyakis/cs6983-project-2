import "server-only";
import {
  cancelOpenSettlement,
  findOpenSettlement,
  findSettlement,
  insertSettlement,
  listClosedSettlements,
  listSettlementPayments,
  type ClosedPeriod,
  type Payment,
  type Settlement,
} from "@/lib/db/settlements";
import { suggestPayments } from "@/lib/domain/settle-up";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
import { requireGroupAccess } from "./access";
import { getGroupBalances } from "./balance-service";

export type { ClosedPeriod, Payment, Settlement };

// A settle-up with the payments it suggested (#19, AGENTS.md Section 6.10).
export type SettleUp = Settlement & { payments: Payment[] };

async function loadSettleUp(settlementId: string): Promise<SettleUp> {
  const settlement = await findSettlement(settlementId);
  if (!settlement) {
    throw new Error("The settle-up could not be loaded.");
  }
  return {
    ...settlement,
    payments: await listSettlementPayments(settlementId),
  };
}

// Any current member can start one. The balances at this moment are turned
// into the fewest payments in lib/domain and stored with the settlement;
// what is added afterwards belongs to the next period. With nothing to pay,
// the database closes the period at once.
export async function startSettleUp(
  userId: string,
  groupId: string,
): Promise<SettleUp> {
  const { group } = await requireGroupAccess(userId, groupId, "write");
  if (group.isPersonal) {
    throw new ConflictError("A personal space has nothing to settle.");
  }
  if (await findOpenSettlement(groupId)) {
    throw new ConflictError("A settle-up is already open in this group.");
  }
  const payments = suggestPayments(await getGroupBalances(userId, groupId));
  const settlementId = await insertSettlement(groupId, userId, payments);
  return loadSettleUp(settlementId);
}

// The group's open settle-up. A former member only sees one started before
// they left (Section 6.6).
export async function getCurrentSettleUp(
  userId: string,
  groupId: string,
): Promise<SettleUp> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  const open = await findOpenSettlement(groupId);
  if (!open || (readUntil !== null && open.startedAt > readUntil)) {
    throw new NotFoundError("No settle-up is open in this group.");
  }
  return { ...open, payments: await listSettlementPayments(open.id) };
}

// Any current member can cancel while every payment is still suggested; the
// database refuses once one is marked paid.
export async function cancelSettleUp(
  userId: string,
  groupId: string,
): Promise<void> {
  await requireGroupAccess(userId, groupId, "write");
  await cancelOpenSettlement(groupId);
}

// Closed periods, newest first (DESIGN.md "PastPeriods").
export async function listPastPeriods(
  userId: string,
  groupId: string,
): Promise<ClosedPeriod[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  return listClosedSettlements(groupId, readUntil);
}
