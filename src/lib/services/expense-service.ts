import "server-only";
import {
  createExpense,
  findExpense,
  listExpenses,
  type Expense,
} from "@/lib/db/expenses";
import { listCurrentMemberWeights } from "@/lib/db/group-members";
import { checkCustomShares, splitByWeights } from "@/lib/domain/splits";
import { ValidationError } from "@/lib/http/errors";
import type { CreateExpenseInput } from "@/lib/validation/expense";
import { requireGroupAccess } from "./access";

// Adds an expense paid by the current user (AGENTS.md Sections 6.2 and 6.7).
// The payer is never taken from the request. The shares are worked out here, in
// lib/domain, and written with the expense in one call.
export async function addExpense(
  userId: string,
  groupId: string,
  input: CreateExpenseInput,
): Promise<Expense> {
  // Write access means a current member of an active group, so the payer is
  // always a current member.
  await requireGroupAccess(userId, groupId, "write");

  // The database accepts a former member as a sharer, so that old shares
  // survive when someone leaves. This check is what keeps a new cost to current
  // members.
  const current = new Set(
    (await listCurrentMemberWeights(groupId)).map((member) => member.userId),
  );
  if (!input.sharedBy.every((sharerId) => current.has(sharerId))) {
    throw new ValidationError("Check the highlighted fields.", {
      sharedBy: "Everyone sharing this cost must be in the group.",
    });
  }

  // The server's even mode is always 1:1. A group's ratio reaches an expense
  // through SplitEditor, as custom amounts (AGENTS.md Section 6.3).
  const shares =
    input.mode === "even"
      ? splitByWeights(
          input.amountCents,
          userId,
          input.sharedBy.map((sharerId) => ({ userId: sharerId, weight: 1 })),
        )
      : checkCustomShares(
          input.amountCents,
          userId,
          input.sharedBy,
          input.amountsCents,
        );

  const expenseId = await createExpense({
    groupId,
    description: input.description,
    amountCents: input.amountCents,
    payerId: userId,
    spentOn: input.spentOn,
    shares,
  });
  const expense = await findExpense(expenseId);
  if (!expense) {
    throw new Error("The new expense could not be loaded.");
  }
  return expense;
}

// A former member only sees what was added before they left (AGENTS.md
// Section 6.6).
export async function listGroupExpenses(
  userId: string,
  groupId: string,
): Promise<Expense[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  return listExpenses(groupId, readUntil);
}
