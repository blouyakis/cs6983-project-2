import "server-only";
import type { Share } from "@/lib/domain/splits";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
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

// What an edit replaces (#20). The payer and the group stay as they are.
export type ExpenseEdit = {
  description: string;
  amountCents: number;
  spentOn: string;
  shares: Share[];
};

type ExpenseRow = {
  id: string;
  group_id: string;
  description: string;
  amount_cents: number;
  payer_id: string;
  spent_on: string;
  settlement_id: string | null;
  created_at: string;
  edited_at: string | null;
  expense_shares: { user_id: string; share_cents: number }[];
};

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amountCents: number;
  payerId: string;
  spentOn: string;
  // Settled expenses are locked (AGENTS.md Section 6.7), so the client never
  // offers an edit that would get a 409.
  settled: boolean;
  createdAt: string;
  editedAt: string | null;
  shares: Share[];
};

const EXPENSE_COLUMNS =
  "id, group_id, description, amount_cents, payer_id, spent_on, settlement_id, created_at, edited_at, expense_shares(user_id, share_cents)";

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amountCents: row.amount_cents,
    payerId: row.payer_id,
    spentOn: row.spent_on,
    settled: row.settlement_id !== null,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    shares: row.expense_shares.map((share) => ({
      userId: share.user_id,
      shareCents: share.share_cents,
    })),
  };
}

// The group's expenses, newest day first and, within a day, newest entry
// first. `createdBefore` is a former member's left_at: they only see what was
// added up to the day they left (AGENTS.md Section 6.6). Null shows everything.
export async function listExpenses(
  groupId: string,
  createdBefore: string | null,
): Promise<Expense[]> {
  let query = getDb()
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("group_id", groupId);
  if (createdBefore !== null) {
    query = query.lte("created_at", createdBefore);
  }
  const { data, error } = await query
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load expenses: ${error.message}`);
  }
  return (data as unknown as ExpenseRow[]).map(toExpense);
}

export async function findExpense(expenseId: string): Promise<Expense | null> {
  const { data, error } = await getDb()
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("id", expenseId)
    .maybeSingle<ExpenseRow>();
  if (error) {
    throw new Error(`Could not load the expense: ${error.message}`);
  }
  return data ? toExpense(data) : null;
}

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

// Raised by update_expense when the expense has a settlement. The service
// checks first, so this is the backstop for a settle-up that claimed the
// expense between that check and this call.
// raise_exception and no_data_found, the codes update_expense and
// delete_expense use.
const REFUSED_ERROR_CODE = "P0001";
const NOT_FOUND_ERROR_CODE = "P0002";

// Replaces an unsettled expense's description, amount, day and shares in one
// transaction through update_expense (#20), and marks it edited. The payer
// can't be changed (AGENTS.md Section 6.7), so it isn't a parameter.
export async function updateExpense(
  expenseId: string,
  edit: ExpenseEdit,
): Promise<void> {
  const { error } = await getDb().rpc("update_expense", {
    p_expense_id: expenseId,
    p_description: edit.description,
    p_amount_cents: edit.amountCents,
    p_spent_on: edit.spentOn,
    p_shares: edit.shares.map((share) => ({
      user_id: share.userId,
      share_cents: share.shareCents,
    })),
  });
  if (error) {
    if (error.code === REFUSED_ERROR_CODE) {
      // Settled, or in a settle-up that is still open (#86): the function's
      // message says which.
      throw new ConflictError(error.message);
    }
    if (error.code === NOT_FOUND_ERROR_CODE) {
      throw new NotFoundError("This expense doesn't exist.");
    }
    throw new Error(`Could not update the expense: ${error.message}`);
  }
}

// Removes an expense. Its shares cascade, and a list item it came from keeps
// its done state with no expense (architecture.md Section 5).
// delete_expense makes the same checks as update_expense (#86): a settled
// expense or one in an open settle-up is refused. The shares cascade.
export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await getDb().rpc("delete_expense", {
    p_expense_id: expenseId,
  });
  if (error) {
    if (error.code === REFUSED_ERROR_CODE) {
      throw new ConflictError(error.message);
    }
    if (error.code === NOT_FOUND_ERROR_CODE) {
      throw new NotFoundError("This expense doesn't exist.");
    }
    throw new Error(`Could not delete the expense: ${error.message}`);
  }
}

// Just the day and amount of the group's expenses dated from `from` up to,
// not including, `before`, for spending totals (#90), so a long history
// isn't loaded to add up one month. `createdBefore` is a former member's
// left_at, as in listExpenses.
export async function listExpensesSpentBetween(
  groupId: string,
  from: string,
  before: string,
  createdBefore: string | null,
): Promise<{ spentOn: string; amountCents: number }[]> {
  let query = getDb()
    .from("expenses")
    .select("spent_on, amount_cents")
    .eq("group_id", groupId)
    .gte("spent_on", from)
    .lt("spent_on", before);
  if (createdBefore !== null) {
    query = query.lte("created_at", createdBefore);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Could not load expenses: ${error.message}`);
  }
  return (data as { spent_on: string; amount_cents: number }[]).map((row) => ({
    spentOn: row.spent_on,
    amountCents: row.amount_cents,
  }));
}
