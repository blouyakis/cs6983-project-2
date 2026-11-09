import "server-only";
import type { ExpenseLock } from "@/lib/domain/expense-lock";
import type { ListItemStatus } from "@/lib/domain/list-stats";
import type { Share } from "@/lib/domain/splits";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import { getDb } from "./client";
import { MEMBER_LEFT_HINT } from "./expenses";

// Things to do or buy, in a group or a personal space (#11). Checking an item
// off and unchecking it write two tables, so they are Postgres functions (#12).

type ListItemRow = {
  id: string;
  group_id: string;
  title: string;
  quantity: number | null;
  note: string | null;
  estimated_cents: number | null;
  status: ListItemStatus;
  added_by: string;
  completed_by: string | null;
  completed_at: string | null;
  expense_id: string | null;
  created_at: string;
};

export type ListItem = {
  id: string;
  groupId: string;
  title: string;
  quantity: number | null;
  note: string | null;
  estimatedCents: number | null;
  status: ListItemStatus;
  // A user id. The page turns it into a name from the group's members.
  addedBy: string;
  completedBy: string | null;
  completedAt: string | null;
  // The expense it was checked off with (#12). Null when open, checked off
  // with no cost, or when that expense was later deleted on its own.
  expenseId: string | null;
  createdAt: string;
};

// An item as the list service sends it (#12): with the actual cost of a done
// item, and whether its expense is locked, so the client never offers an
// uncheck that would get a 409 (DESIGN.md "ListItemRow").
export type ListedItem = ListItem & {
  costCents: number | null;
  expenseLock: ExpenseLock | null;
};

export type NewListItem = {
  groupId: string;
  title: string;
  quantity: number | null;
  note: string | null;
  estimatedCents: number | null;
  addedBy: string;
};

export type ListItemChanges = Partial<{
  title: string;
  quantity: number | null;
  note: string | null;
  estimatedCents: number | null;
}>;

const LIST_ITEM_COLUMNS =
  "id, group_id, title, quantity, note, estimated_cents, status, added_by, completed_by, completed_at, expense_id, created_at";

function toListItem(row: ListItemRow): ListItem {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    quantity: row.quantity,
    note: row.note,
    estimatedCents: row.estimated_cents,
    status: row.status,
    addedBy: row.added_by,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    expenseId: row.expense_id,
    createdAt: row.created_at,
  };
}

// Only the keys present are written, so an edit never clears a field it
// didn't send.
function toColumns(changes: ListItemChanges): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if (changes.title !== undefined) columns.title = changes.title;
  if (changes.quantity !== undefined) columns.quantity = changes.quantity;
  if (changes.note !== undefined) columns.note = changes.note;
  if (changes.estimatedCents !== undefined) {
    columns.estimated_cents = changes.estimatedCents;
  }
  return columns;
}

export async function insertListItem(item: NewListItem): Promise<ListItem> {
  const { data, error } = await getDb()
    .from("list_items")
    .insert({
      group_id: item.groupId,
      title: item.title,
      quantity: item.quantity,
      note: item.note,
      estimated_cents: item.estimatedCents,
      added_by: item.addedBy,
    })
    .select(LIST_ITEM_COLUMNS)
    .single<ListItemRow>();
  if (error) {
    throw new Error(`Could not add the list item: ${error.message}`);
  }
  return toListItem(data);
}

// Open items first, then done ones, newest first in each. Status sorts
// descending because "open" comes after "done" alphabetically, and
// list_items_status_valid allows only those two. `createdBefore` is a former
// member's left_at, as in listExpenses (AGENTS.md Section 6.6).
export async function listListItems(
  groupId: string,
  createdBefore: string | null,
): Promise<ListItem[]> {
  let query = getDb()
    .from("list_items")
    .select(LIST_ITEM_COLUMNS)
    .eq("group_id", groupId);
  if (createdBefore !== null) {
    query = query.lte("created_at", createdBefore);
  }
  const { data, error } = await query
    .order("status", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load the list: ${error.message}`);
  }
  return (data as ListItemRow[]).map(toListItem);
}

// Only the open items, newest first, for the overview's My list (#90).
// `createdBefore` is a former member's left_at, as in listListItems.
export async function listOpenListItems(
  groupId: string,
  createdBefore: string | null,
): Promise<ListItem[]> {
  let query = getDb()
    .from("list_items")
    .select(LIST_ITEM_COLUMNS)
    .eq("group_id", groupId)
    .eq("status", "open");
  if (createdBefore !== null) {
    query = query.lte("created_at", createdBefore);
  }
  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) {
    throw new Error(`Could not load the list: ${error.message}`);
  }
  return (data as ListItemRow[]).map(toListItem);
}

export async function findListItem(
  groupId: string,
  itemId: string,
): Promise<ListItem | null> {
  const { data, error } = await getDb()
    .from("list_items")
    .select(LIST_ITEM_COLUMNS)
    .eq("group_id", groupId)
    .eq("id", itemId)
    .maybeSingle<ListItemRow>();
  if (error) {
    throw new Error(`Could not load the list item: ${error.message}`);
  }
  return data ? toListItem(data) : null;
}

// The status check is part of the update, so an item checked off between the
// service's check and this write is left alone. Null when no open item in the
// group has this id.
export async function updateOpenListItem(
  groupId: string,
  itemId: string,
  changes: ListItemChanges,
): Promise<ListItem | null> {
  const { data, error } = await getDb()
    .from("list_items")
    .update(toColumns(changes))
    .eq("group_id", groupId)
    .eq("id", itemId)
    .eq("status", "open")
    .select(LIST_ITEM_COLUMNS)
    .maybeSingle<ListItemRow>();
  if (error) {
    throw new Error(`Could not update the list item: ${error.message}`);
  }
  return data ? toListItem(data) : null;
}

// Open items are the one thing besides expenses that is hard-deleted
// (architecture.md Section 5): they have no expense and no history to keep.
// False when no open item in the group has this id.
export async function deleteOpenListItem(
  groupId: string,
  itemId: string,
): Promise<boolean> {
  const { data, error } = await getDb()
    .from("list_items")
    .delete()
    .eq("group_id", groupId)
    .eq("id", itemId)
    .eq("status", "open")
    .select("id");
  if (error) {
    throw new Error(`Could not delete the list item: ${error.message}`);
  }
  return data.length > 0;
}

export type CheckOffExpense = {
  amountCents: number;
  settled: boolean;
  createdAt: string;
  shares: Share[];
};

type CheckOffExpenseRow = {
  id: string;
  amount_cents: number;
  settlement_id: string | null;
  created_at: string;
  expense_shares: { user_id: string; share_cents: number }[];
};

// The expenses done items were checked off with, by id: what each cost, and
// what it takes to tell whether it is locked (lib/domain/expense-lock.ts),
// including the shares, for a sharer who has left (#22).
export async function listCheckOffExpenses(
  expenseIds: readonly string[],
): Promise<Map<string, CheckOffExpense>> {
  const expenses = new Map<string, CheckOffExpense>();
  if (expenseIds.length === 0) {
    return expenses;
  }
  const { data, error } = await getDb()
    .from("expenses")
    .select(
      "id, amount_cents, settlement_id, created_at, expense_shares(user_id, share_cents)",
    )
    .in("id", expenseIds);
  if (error) {
    throw new Error(`Could not load the list's expenses: ${error.message}`);
  }
  for (const row of data as CheckOffExpenseRow[]) {
    expenses.set(row.id, {
      amountCents: row.amount_cents,
      settled: row.settlement_id !== null,
      createdAt: row.created_at,
      shares: row.expense_shares.map((share) => ({
        userId: share.user_id,
        shareCents: share.share_cents,
      })),
    });
  }
  return expenses;
}

// What an item cost when it was checked off and who shares it: each sharer's
// user id and share in cents (#12). No cost is 0 with no shares.
export type CheckOff = {
  amountCents: number;
  shares: Record<string, number>;
};

// The codes complete_list_item and reopen_list_item raise: raise_exception
// (from delete_expense), no_data_found and insufficient_privilege.
const REFUSED_ERROR_CODE = "P0001";
const NOT_FOUND_ERROR_CODE = "P0002";
const NOT_ALLOWED_ERROR_CODE = "42501";

// Marks an open item done and, with a cost, writes its expense paid by the
// user, in one transaction. False when no open item in the group has this id.
export async function completeOpenListItem(
  groupId: string,
  itemId: string,
  userId: string,
  checkOff: CheckOff,
): Promise<boolean> {
  const { error } = await getDb().rpc("complete_list_item", {
    item_id: itemId,
    user_id: userId,
    group_id: groupId,
    amount_cents: checkOff.amountCents,
    // An object, never JSON.stringify(...): a string reaches Postgres as a
    // jsonb string, not an object, and the function can't read the shares.
    shares: checkOff.shares,
  });
  if (error) {
    if (error.code === NOT_FOUND_ERROR_CODE) {
      return false;
    }
    if (error.code === NOT_ALLOWED_ERROR_CODE) {
      throw new ForbiddenError();
    }
    // A sharer left the group after the service checked (#22).
    if (error.hint === MEMBER_LEFT_HINT) {
      throw new ConflictError(error.message);
    }
    throw new Error(`Could not check off the list item: ${error.message}`);
  }
  return true;
}

// Reopens a done item and deletes its expense, if it has one, in one
// transaction (AGENTS.md Section 6.7). False when no done item in the group
// has this id.
export async function reopenDoneListItem(
  groupId: string,
  itemId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await getDb().rpc("reopen_list_item", {
    item_id: itemId,
    user_id: userId,
    group_id: groupId,
  });
  if (error) {
    if (error.code === NOT_FOUND_ERROR_CODE) {
      return false;
    }
    if (error.code === NOT_ALLOWED_ERROR_CODE) {
      throw new ForbiddenError(
        "Only the member who checked it off can uncheck it.",
      );
    }
    if (error.code === REFUSED_ERROR_CODE) {
      // Settled, or in a settle-up that is still open: the message says which.
      throw new ConflictError(error.message);
    }
    throw new Error(`Could not uncheck the list item: ${error.message}`);
  }
  return true;
}

// How many items are open on each group's list, for "3 open on the list" on a
// GroupCard (#10). Every group asked about gets a count, 0 if it has none.
// Only ever called for groups the user is in now, so there's no cut-off.
export async function countOpenListItems(
  groupIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map(groupIds.map((groupId) => [groupId, 0]));
  if (groupIds.length === 0) {
    return counts;
  }
  const { data, error } = await getDb()
    .from("list_items")
    .select("group_id")
    .eq("status", "open")
    .in("group_id", groupIds);
  if (error) {
    throw new Error(`Could not count the open list items: ${error.message}`);
  }
  for (const row of data as { group_id: string }[]) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  }
  return counts;
}
