import Link from "next/link";
import { describeSplit } from "@/lib/domain/describe-split";
import type { GroupSummary } from "@/lib/services/group-service";
import { GroupTile } from "./GroupTile";

type GroupCardProps = { group: GroupSummary; currentUserId: string };

// The current user comes first, as "You", then everyone else in the order
// they joined: "You, Sam, Jo".
function memberNames(group: GroupSummary, currentUserId: string): string {
  const others = group.members
    .filter((member) => member.userId !== currentUserId)
    .map((member) => member.name);
  const isMember = others.length < group.members.length;
  return [...(isMember ? ["You"] : []), ...others].join(", ");
}

// One shared group on the Groups page (DESIGN.md "GroupCard").
export function GroupCard({ group, currentUserId }: GroupCardProps) {
  const split = describeSplit(
    group.members.map((member) => member.defaultShareWeight),
  );
  return (
    <article className="flex flex-col gap-4 rounded-2xl border-4 border-ink bg-surface p-4">
      <div className="flex items-center gap-3">
        <GroupTile name={group.name} />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{group.name}</h3>
          <p className="text-sm font-semibold text-muted">
            {memberNames(group, currentUserId)} · {split}
          </p>
        </div>
      </div>
      {/* TODO(#11): show how many items are open on the list. */}
      {/* TODO(#10): show the user's balance in words with MoneyText, once the
          overview loads balances for every group in one go (#9 serves them
          per group). */}
      <div className="border-t-2 border-dashed border-divider pt-3">
        {/* TODO(#7): add Add plan here, and TODO(#19) the settle-up button. */}
        <Link
          href={`/groups/${group.id}`}
          className="inline-block rounded-lg border-2 border-ink bg-action px-4 py-2 font-semibold text-white shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <span aria-hidden="true">🛒 </span>Open
        </Link>
      </div>
    </article>
  );
}
