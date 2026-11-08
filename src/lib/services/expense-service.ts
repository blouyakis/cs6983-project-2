import "server-only";
import {
  createExpense,
  findExpense,
  listExpenses,
  listExpensesSpentBetween,
  type Expense,
} from "@/lib/db/expenses";
import type { CreateExpenseInput } from "@/lib/validation/expense";
import { requireGroupAccess } from "./access";
import { sharesOfNewCost } from "./shares";

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

  const shares = await sharesOfNewCost(
    userId,
    groupId,
    input.amountCents,
    input,
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

// Just the day and amount of the expenses dated from `from` up to, not
// including, `before`, for a spending total such as the overview's (#90).
// A former member only gets what was added before they left (Section 6.6).
export async function listGroupExpensesSpentBetween(
  userId: string,
  groupId: string,
  from: string,
  before: string,
): Promise<{ spentOn: string; amountCents: number }[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  return listExpensesSpentBetween(groupId, from, before, readUntil);
}
