import { ListItemRow } from "@/components/lists/ListItemRow";
import { MoneyText } from "@/components/ui/MoneyText";
import type { ListItem } from "@/lib/db/list-items";

type MyListProps = {
  // The personal space's open items.
  items: ListItem[];
  openEstimateCents: number;
};

// "My list" on the phone overview: the personal space's open items and
// their estimated total. Editing and deleting stay on the personal list.
export function MyList({ items, openEstimateCents }: MyListProps) {
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
        // TODO(#12): let these rows be checked off, as on the personal list.
        <ul>
          {items.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              addedByName="You"
              completedByName={null}
              isPersonal
            />
          ))}
        </ul>
      )}
    </section>
  );
}
