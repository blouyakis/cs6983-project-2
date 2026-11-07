import Link from "next/link";
import { AddPlanButton } from "@/components/expenses/AddPlanButton";
import type { EntryGroup } from "@/components/expenses/EntryForm";
import { MoneyText } from "@/components/ui/MoneyText";
import { describeSplit } from "@/lib/domain/describe-split";
import type { GroupStanding } from "@/lib/services/overview-service";
import { GroupTile } from "./GroupTile";

type GroupCardProps = {
  group: GroupStanding;
  currentUserId: string;
  // For Add plan here's form, which can switch to another group.
  addableGroups: EntryGroup[];
  // The overview's version: one row on desktop, with the user's share.
  wide?: boolean;
};

// The current user comes first, as "You", then everyone else in the order
// they joined: "You, Sam, Jo".
function memberNames(group: GroupStanding, currentUserId: string): string {
  const others = group.members
    .filter((member) => member.userId !== currentUserId)
    .map((member) => member.name);
  const isMember = others.length < group.members.length;
  return [...(isMember ? ["You"] : []), ...others].join(", ");
}

function openItems(count: number): string {
  return count === 0 ? "Nothing open on the list" : `${count} open on the list`;
}

// One shared group on the overview and the Groups page (DESIGN.md
// "GroupCard"). The balance comes from the server (#9) and is written in
// words by MoneyText.
export function GroupCard({
  group,
  currentUserId,
  addableGroups,
  wide = false,
}: GroupCardProps) {
  const split = describeSplit(
    group.members.map((member) => member.defaultShareWeight),
  );
  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border-4 border-ink bg-surface p-4 ${
        wide ? "lg:flex-row lg:items-center" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3 lg:flex-1">
        <GroupTile name={group.name} />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{group.name}</h3>
          <p className="text-sm font-semibold text-muted">
            {memberNames(group, currentUserId)} · {split}
          </p>
        </div>
      </div>
      <div
        className={`flex flex-wrap items-baseline justify-between gap-2 border-t-2 border-dashed border-divider pt-3 ${
          wide ? "lg:border-0 lg:pt-0" : ""
        }`}
      >
        <p className="text-sm font-semibold text-muted">
          <span>{openItems(group.openItemCount)}</span>
          {wide ? (
            <span>
              {" · your share "}
              <MoneyText cents={group.shareThisPeriodCents} />
            </span>
          ) : null}
        </p>
        <p className="text-lg font-bold">
          <MoneyText cents={group.balanceCents} as="balance" />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/groups/${group.id}`}
          className="rounded-lg border-2 border-ink bg-action px-4 py-2 font-semibold text-white shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <span aria-hidden="true">🛒 </span>Open
        </Link>
        <AddPlanButton
          groups={addableGroups}
          currentUserId={currentUserId}
          defaultGroupId={group.id}
          label="Add plan here"
          accessibleName={`Add plan here, ${group.name}`}
        />
        <Link
          href={`/groups/${group.id}/settle-up`}
          aria-label={`Settle up ${group.name}`}
          className="rounded-lg border-2 border-ink bg-surface px-3 py-2 shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <span aria-hidden="true">💸</span>
        </Link>
      </div>
    </article>
  );
}
