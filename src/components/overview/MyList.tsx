"use client";

import { ListItemRow } from "@/components/lists/ListItemRow";
import { useCheckOff } from "@/components/lists/use-check-off";
import { MoneyText } from "@/components/ui/MoneyText";
import type { ListItem } from "@/lib/db/list-items";

type MyListProps = {
  // The personal space, which these items are on.
  groupId: string;
  currentUserId: string;
  // The personal space's open items.
  items: ListItem[];
  openEstimateCents: number;
};

// "My list" on the phone overview: the personal space's open items and
// their estimated total. An item is checked off here as on the personal list,
// logging a personal expense (#12, #23); once done it leaves this list, so
// unchecking, editing and deleting stay on the personal list.
export function MyList({
  groupId,
  currentUserId,
  items,
  openEstimateCents,
}: MyListProps) {
  const checkOff = useCheckOff({
    groupId,
    isPersonal: true,
    members: [],
    currentUserId,
  });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">
          <span aria-hidden="true">📝 </span>My list
        </h2>
        <p className="font-semibold text-muted">
          est. <MoneyText cents={openEstimateCents} /> open
        </p>
      </div>
      {items.length === 0 ? (
        <p>Nothing planned yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              addedByName="You"
              completedByName={null}
              isPersonal
              onCheckChange={(chosen) => checkOff.start(chosen, null)}
            />
          ))}
        </ul>
      )}
      {checkOff.elements}
    </section>
  );
}
