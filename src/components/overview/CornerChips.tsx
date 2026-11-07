import Link from "next/link";
import { MoneyText } from "@/components/ui/MoneyText";
import type { GroupStanding } from "@/lib/services/overview-service";

type CornerChipsProps = {
  // The personal space, always first. Null only for a user without one.
  personal: { id: string; spentThisMonthCents: number } | null;
  groups: GroupStanding[];
};

const CHIP =
  "flex h-full w-40 flex-col gap-1 rounded-2xl border-4 border-ink p-3 font-semibold";

// The phone overview's row of the personal space and each group
// (DESIGN.md "CornerChips"). It scrolls sideways when there are many.
export function CornerChips({ personal, groups }: CornerChipsProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">Your corners of life</h2>
        <Link href="/groups" className="font-bold text-owe">
          all groups <span aria-hidden="true">›</span>
        </Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {personal ? (
          <li className="shrink-0">
            <Link
              href={`/groups/${personal.id}`}
              className={`${CHIP} bg-ink text-surface`}
            >
              <span aria-hidden="true" className="text-2xl">
                🙋
              </span>
              <span className="text-lg font-bold">Just me</span>
              <span className="text-sm">
                <MoneyText cents={personal.spentThisMonthCents} /> this month
              </span>
            </Link>
          </li>
        ) : null}
        {groups.map((group) => (
          <li key={group.id} className="shrink-0">
            <Link href={`/groups/${group.id}`} className={`${CHIP} bg-surface`}>
              <span className="truncate text-lg font-bold">{group.name}</span>
              <span className="text-sm">
                <MoneyText cents={group.balanceCents} as="balance" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
