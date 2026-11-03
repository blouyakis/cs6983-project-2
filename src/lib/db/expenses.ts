import "server-only";
import type { Share } from "@/lib/domain/splits";
import { getDb } from "./client";

export type NewExpense = {
  groupId: string;
  description: string;
  amountCents: number;
  payerId: string;
  // A calendar day, such as "2026-10-20".
  spentOn: string;
  shares: Share[];
};

// Writes an expense and its shares in one transaction through create_expense
// (#43), so an expense never exists without shares that add up to its amount.
// Returns the new expense's id.
export async function createExpense(expense: NewExpense): Promise<string> {
  const { data, error } = await getDb().rpc("create_expense", {
    p_group_id: expense.groupId,
    p_description: expense.description,
    p_amount_cents: expense.amountCents,
    p_payer_id: expense.payerId,
    p_spent_on: expense.spentOn,
    p_shares: expense.shares.map((share) => ({
      user_id: share.userId,
      share_cents: share.shareCents,
    })),
  });
  if (error) {
    throw new Error(`Could not create the expense: ${error.message}`);
  }
  return data as string;
}
