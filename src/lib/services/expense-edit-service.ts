import "server-only";
import {
  deleteExpense,
  findExpense,
  updateExpense,
  type Expense,
} from "@/lib/db/expenses";
import { listCurrentMemberWeights } from "@/lib/db/group-members";
import { expenseLock } from "@/lib/domain/expense-lock";
import { checkCustomShares, splitByWeights } from "@/lib/domain/splits";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import type { UpdateExpenseInput } from "@/lib/validation/expense";
import { requireGroupAccess } from "./access";

// Editing and deleting an expense (#20, AGENTS.md Section 6.7): only the
// payer, and only while it is unsettled. The payer can't be changed; to fix
// a wrong payer, delete the expense and add it again.

// The expense, once the user may change it, and the group's current members.
// Write access means a current member of an active group, so a former member
// or an archived group is 403 before anything is looked up. A settled
// expense, and one that someone who has left has a non-zero share in (#22),
// is 409. The open settle-up's lock is left to update_expense and
// delete_expense, which check it under the row lock.
async function requireEditableExpense(
  userId: string,
  groupId: string,
  expenseId: string,
): Promise<{ expense: Expense; currentMemberIds: Set<string> }> {
  await requireGroupAccess(userId, groupId, "write");
  const expense = await findExpense(expenseId);
  if (!expense || expense.groupId !== groupId) {
    throw new NotFoundError("This expense doesn't exist.");
  }
  if (expense.payerId !== userId) {
    throw new ForbiddenError(
      "Only the person who paid can change this expense.",
    );
  }
  const currentMemberIds = new Set(
    (await listCurrentMemberWeights(groupId)).map((member) => member.userId),
  );
  const lock = expenseLock(expense, null, currentMemberIds);
  if (lock === "settled") {
    throw new ConflictError(
      "This expense has been settled, so it can't be changed.",
    );
  }
  if (lock === "member-left") {
    throw new ConflictError(
      "Someone who shares this expense has left the group, so it can't be changed until it's settled.",
    );
  }
  return { expense, currentMemberIds };
}

// Replaces the description, amount, day and split. The shares are worked out
// here, in lib/domain, with the saved payer, so an edit that leaves the payer
// out of the sharers is a 400 (Section 6.2).
export async function editExpense(
  userId: string,
  groupId: string,
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<Expense> {
  const { expense, currentMemberIds } = await requireEditableExpense(
    userId,
    groupId,
    expenseId,
  );

  if (!input.sharedBy.every((sharerId) => currentMemberIds.has(sharerId))) {
    throw new ValidationError("Check the highlighted fields.", {
      sharedBy: "Everyone sharing this cost must be in the group.",
    });
  }

  const shares =
    input.mode === "even"
      ? splitByWeights(
          input.amountCents,
          expense.payerId,
          input.sharedBy.map((sharerId) => ({ userId: sharerId, weight: 1 })),
        )
      : checkCustomShares(
          input.amountCents,
          expense.payerId,
          input.sharedBy,
          input.amountsCents,
        );

  await updateExpense(expenseId, {
    description: input.description,
    amountCents: input.amountCents,
    spentOn: input.spentOn,
    shares,
  });
  const edited = await findExpense(expenseId);
  if (!edited) {
    throw new Error("The edited expense could not be loaded.");
  }
  return edited;
}

// Deletes the expense. Balances are computed per request, so they reflect
// it at once; a list item it came from stays done with no expense.
export async function removeExpense(
  userId: string,
  groupId: string,
  expenseId: string,
): Promise<void> {
  await requireEditableExpense(userId, groupId, expenseId);
  await deleteExpense(expenseId);
}
