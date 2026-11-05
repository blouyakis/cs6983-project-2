import "server-only";
import type { ListItemStatus } from "@/lib/domain/list-stats";
import { getDb } from "./client";

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
  createdAt: string;
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
  "id, group_id, title, quantity, note, estimated_cents, status, added_by, completed_by, completed_at, created_at";

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
