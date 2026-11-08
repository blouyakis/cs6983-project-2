import "server-only";
import {
  deleteOpenListItem,
  findListItem,
  insertListItem,
  listListItems,
  listOpenListItems,
  updateOpenListItem,
  type ListItem,
} from "@/lib/db/list-items";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
import type {
  CreateListItemInput,
  UpdateListItemInput,
} from "@/lib/validation/list-item";
import { requireGroupAccess } from "./access";

// A group's list of things to do or buy (#11). Any current member can add,
// edit or delete an open item. A done item is linked to what it cost, so it
// has to be unchecked first (#12, AGENTS.md Section 6.7).

const UNCHECK_FIRST = "This item is done. Uncheck it first to change it.";

// Added by the current user, never by an id from the request.
export async function addListItem(
  userId: string,
  groupId: string,
  input: CreateListItemInput,
): Promise<ListItem> {
  await requireGroupAccess(userId, groupId, "write");
  return insertListItem({ groupId, addedBy: userId, ...input });
}

// A former member only sees what was added before they left (AGENTS.md
// Section 6.6).
export async function listGroupListItems(
  userId: string,
  groupId: string,
): Promise<ListItem[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  return listListItems(groupId, readUntil);
}

// Only the open items, newest first, for the overview (#90), with the same
// cut-off for a former member.
export async function listGroupOpenListItems(
  userId: string,
  groupId: string,
): Promise<ListItem[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  return listOpenListItems(groupId, readUntil);
}

// The write already skipped a done item, so this only decides which error to
// give: 409 for a done item, 404 for one that isn't in the group.
async function refuse(groupId: string, itemId: string): Promise<never> {
  if (await findListItem(groupId, itemId)) {
    throw new ConflictError(UNCHECK_FIRST);
  }
  throw new NotFoundError("This item isn't on the list.");
}

export async function editListItem(
  userId: string,
  groupId: string,
  itemId: string,
  changes: UpdateListItemInput,
): Promise<ListItem> {
  await requireGroupAccess(userId, groupId, "write");
  const edited = await updateOpenListItem(groupId, itemId, changes);
  return edited ?? refuse(groupId, itemId);
}

export async function removeListItem(
  userId: string,
  groupId: string,
  itemId: string,
): Promise<void> {
  await requireGroupAccess(userId, groupId, "write");
  if (!(await deleteOpenListItem(groupId, itemId))) {
    await refuse(groupId, itemId);
  }
}
