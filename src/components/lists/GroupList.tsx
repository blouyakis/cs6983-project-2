"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntryForm, type EntryGroup } from "@/components/expenses/EntryForm";
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
  const [editing, setEditing] = useState<ListItem>();
  const [notice, setNotice] = useState<string>();

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

  async function remove(item: ListItem) {
    setNotice(undefined);
    const { text } = splitLeadingEmoji(item.title);
    const result = await deleteJson(
      `/api/groups/${groupId}/list-items/${item.id}`,
    );
    setNotice(result.ok ? `Deleted ${text}.` : result.error.message);
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
              onEdit={readOnly ? undefined : setEditing}
              onDelete={readOnly ? undefined : remove}
            />
          ))}
        </ul>
      )}
      {/* The region stays in the page, so a notice is announced when it
          appears instead of being created along with its text. */}
      <p role="status" className="font-semibold">
        {notice}
      </p>
      {readOnly ? null : (
        <>
          <div>
            <PrimaryButton
              onClick={() => {
                setNotice(undefined);
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
            onPlanned={() => router.refresh()}
            onAdded={() => router.refresh()}
          />
        </>
      )}
      {editing ? (
        <EditListItemForm
          key={editing.id}
          item={editing}
          open
          onClose={() => setEditing(undefined)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}
