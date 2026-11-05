"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { EntryForm, type EntryGroup } from "@/components/expenses/EntryForm";
import { expenseNotice, planNotice } from "@/components/expenses/entry-notices";
import { useNotice } from "@/components/ui/NoticeProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ListItem } from "@/lib/db/list-items";
import { openEstimateTotalCents } from "@/lib/domain/list-stats";
import { splitLeadingEmoji } from "@/lib/domain/leading-emoji";
import { deleteJson } from "@/lib/http/api-client";
import { EditListItemForm } from "./EditListItemForm";
import { ListItemRow } from "./ListItemRow";
import { ListStats } from "./ListStats";

type GroupListProps = {
  groupId: string;
  isPersonal: boolean;
  // A group the user left, or an archived one: the list can be read, not
  // changed (AGENTS.md Section 6.6).
  readOnly: boolean;
  // Open first, then done, newest first in each, as the server sends them.
  items: ListItem[];
  // User id to name, for the members the user can see.
  names: Record<string, string>;
  currentUserId: string;
  // The groups the New entry form can add to, for its group picker.
  entryGroups: EntryGroup[];
};

// A group's or the personal space's list (user flow 2, DESIGN.md "Lists").
// Any current member can add, edit or delete an open item. After a change the
// page is refreshed, so the list and its total come from the server again.
export function GroupList({
  groupId,
  isPersonal,
  readOnly,
  items,
  names,
  currentUserId,
  entryGroups,
}: GroupListProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  // The item stays after the form closes, so FormSheet sees open turn false
  // and returns focus to the Edit button, instead of being unmounted first.
  // Each opening gets a new key, so the form starts from the item as the page
  // has it now, not from what was typed and cancelled last time.
  const [editing, setEditing] = useState<ListItem>();
  const [editOpen, setEditOpen] = useState(false);
  const [editCount, setEditCount] = useState(0);
  // Shown in NoticeLine, above the list on the group page.
  const { show, clear } = useNotice();
  // Items whose delete is on its way. The ref turns away a second click before
  // React has re-rendered the button as disabled.
  const deletingRef = useRef(new Set<string>());
  const [deleting, setDeleting] = useState<ReadonlySet<string>>(new Set());

  function markDeleting(itemId: string, on: boolean) {
    const next = new Set(deletingRef.current);
    if (on) {
      next.add(itemId);
    } else {
      next.delete(itemId);
    }
    deletingRef.current = next;
    setDeleting(next);
  }

  // addedBy can be someone who left before the user joined, whom the user
  // can't see.
  function nameOf(userId: string | null): string | null {
    if (userId === null) {
      return null;
    }
    if (userId === currentUserId) {
      return "You";
    }
    return names[userId] ?? "a former member";
  }

  // TODO(#76): ask with ConfirmDialog first, as DESIGN.md says, once #72
  // brings src/components/ui/ConfirmDialog.tsx to main.
  async function remove(item: ListItem) {
    if (deletingRef.current.has(item.id)) {
      return;
    }
    markDeleting(item.id, true);
    clear();
    const { text } = splitLeadingEmoji(item.title);
    const result = await deleteJson(
      `/api/groups/${groupId}/list-items/${item.id}`,
    );
    if (result.ok) {
      // Delete stays off: the row is still shown until the refresh removes
      // it, and a second click would only get a 404.
      show(`Deleted ${text}.`, "done");
    } else {
      markDeleting(item.id, false);
      show(result.error.message, "problem");
    }
    // On a 409 someone checked it off first, so the list is out of date too.
    router.refresh();
  }

  const openCount = items.filter((item) => item.status === "open").length;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="list-heading">
      <ListStats
        openEstimateCents={openEstimateTotalCents(items)}
        isPersonal={isPersonal}
      />
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="list-heading" className="text-xl font-bold">
          <span aria-hidden="true">📝 </span>To do &amp; buy
        </h2>
        <p className="font-semibold text-muted">{openCount} open</p>
      </div>
      {items.length === 0 ? (
        <p className="text-muted">Nothing on the list yet.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              addedByName={nameOf(item.addedBy) ?? ""}
              completedByName={nameOf(item.completedBy)}
              isPersonal={isPersonal}
              onEdit={
                readOnly
                  ? undefined
                  : (chosen) => {
                      setEditing(chosen);
                      setEditCount((count) => count + 1);
                      setEditOpen(true);
                    }
              }
              onDelete={readOnly ? undefined : remove}
              deleting={deleting.has(item.id)}
            />
          ))}
        </ul>
      )}
      {readOnly ? null : (
        <>
          <div>
            <PrimaryButton
              onClick={() => {
                clear();
                setAdding(true);
              }}
            >
              <span aria-hidden="true">✏️ </span>Add to list
            </PrimaryButton>
          </div>
          <EntryForm
            groups={entryGroups}
            currentUserId={currentUserId}
            defaultGroupId={groupId}
            initialMode="plan"
            open={adding}
            onClose={() => setAdding(false)}
            // Either mode, and any group the picker chose, so the notice says
            // what went where.
            onPlanned={(item, group) => {
              show(planNotice(item, group), "done");
              router.refresh();
            }}
            onAdded={(expense, group) => {
              show(expenseNotice(expense, group), "done");
              router.refresh();
            }}
          />
        </>
      )}
      {editing ? (
        <EditListItemForm
          key={editCount}
          item={editing}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => router.refresh()}
          onRefused={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}
