import "server-only";
import {
  completeOpenListItem,
  deleteOpenListItem,
  findListItem,
  insertListItem,
  listCheckOffExpenses,
  listListItems,
  listOpenListItems,
  reopenDoneListItem,
  updateOpenListItem,
  type ListedItem,
  type ListItem,
} from "@/lib/db/list-items";
import { listCurrentMemberWeights } from "@/lib/db/group-members";
import { findOpenSettlement } from "@/lib/db/settlements";
import { expenseLock } from "@/lib/domain/expense-lock";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
import type {
  CreateListItemInput,
  UpdateListItemInput,
  CompleteItemInput,
} from "@/lib/validation/list-item";
import { requireGroupAccess } from "./access";
import { sharesOfNewCost } from "./shares";

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
// Section 6.6). Each done item comes with what it cost and whether its expense
// is locked (#12), so the list can show the cost and offer an uncheck only
// when it would work.
export async function listGroupListItems(
  userId: string,
  groupId: string,
): Promise<ListedItem[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  const items = await listListItems(groupId, readUntil);
  const expenseIds = items.flatMap((item) =>
    item.expenseId === null ? [] : [item.expenseId],
  );
  if (expenseIds.length === 0) {
    return items.map((item) => ({
      ...item,
      costCents: null,
      expenseLock: null,
    }));
  }
  const [expenses, openSettleUp, current] = await Promise.all([
    listCheckOffExpenses(expenseIds),
    findOpenSettlement(groupId),
    listCurrentMemberWeights(groupId),
  ]);
  const currentMemberIds = new Set(current.map((member) => member.userId));
  return items.map((item) => {
    const expense =
      item.expenseId === null ? undefined : expenses.get(item.expenseId);
    return {
      ...item,
      costCents: expense?.amountCents ?? null,
      expenseLock: expense
        ? expenseLock(
            expense,
            openSettleUp?.startedAt ?? null,
            currentMemberIds,
          )
        : null,
    };
  });
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

const NOT_ON_LIST = "This item isn't on the list.";

// The write already skipped an item in the wrong state, so this only decides
// which error to give: 409 with `conflict` for an item in the group, 404 for
// one that isn't.
async function refuse(
  groupId: string,
  itemId: string,
  conflict = UNCHECK_FIRST,
): Promise<never> {
  if (await findListItem(groupId, itemId)) {
    throw new ConflictError(conflict);
  }
  throw new NotFoundError(NOT_ON_LIST);
}

// The item as it is after a write that succeeded.
async function reload(groupId: string, itemId: string): Promise<ListItem> {
  const item = await findListItem(groupId, itemId);
  if (!item) {
    throw new NotFoundError(NOT_ON_LIST);
  }
  return item;
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

// The current user pays, never an id from the request (user flow 2). The
// cost is split here, as for a new expense; in the personal space it is all
// the owner's (#23), and a cost of 0 writes no expense at all.
export async function completeListItem(
  userId: string,
  groupId: string,
  itemId: string,
  input: CompleteItemInput,
): Promise<ListItem> {
  const { group } = await requireGroupAccess(userId, groupId, "write");
  let shares: Record<string, number> = {};
  if (input.amountCents > 0) {
    shares = group.isPersonal
      ? { [userId]: input.amountCents }
      : Object.fromEntries(
          (
            await sharesOfNewCost(userId, groupId, input.amountCents, input)
          ).map((share) => [share.userId, share.shareCents]),
        );
  }
  const checkOff = { amountCents: input.amountCents, shares };
  if (!(await completeOpenListItem(groupId, itemId, userId, checkOff))) {
    await refuse(groupId, itemId, "This item is already checked off.");
  }
  return reload(groupId, itemId);
}

// Only the member who checked it off may, while its expense can still be
// deleted; the database checks both (AGENTS.md Section 6.7).
export async function reopenListItem(
  userId: string,
  groupId: string,
  itemId: string,
): Promise<ListItem> {
  await requireGroupAccess(userId, groupId, "write");
  if (!(await reopenDoneListItem(groupId, itemId, userId))) {
    await refuse(groupId, itemId, "This item is already open.");
  }
  return reload(groupId, itemId);
}
