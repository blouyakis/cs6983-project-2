import "server-only";
import {
  deleteExpense,
  findExpense,
  updateExpense,
  type Expense,
} from "@/lib/db/expenses";
import { listCurrentMemberWeights } from "@/lib/db/group-members";
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

// The expense, once the user may change it. Write access means a current
// member of an active group, so a former member or an archived group is 403
// before anything is looked up.
async function requireEditableExpense(
  userId: string,
  groupId: string,
  expenseId: string,
): Promise<Expense> {
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
  if (expense.settled) {
    throw new ConflictError(
      "This expense has been settled, so it can't be changed.",
    );
  }
  return expense;
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
  const expense = await requireEditableExpense(userId, groupId, expenseId);

  const current = new Set(
    (await listCurrentMemberWeights(groupId)).map((member) => member.userId),
  );
  if (!input.sharedBy.every((sharerId) => current.has(sharerId))) {
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
