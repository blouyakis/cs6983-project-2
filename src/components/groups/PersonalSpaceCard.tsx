import Link from "next/link";
import type { GroupSummary } from "@/lib/services/group-service";

// The user's own space, always first on the Groups page
// (DESIGN.md "PersonalSpaceCard").
export function PersonalSpaceCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 rounded-2xl border-4 border-ink bg-surface p-4"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-sidebar text-2xl"
      >
        🔒
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{group.name}</span>
        {/* TODO(#23): add its open items and this month's spending. */}
        <span className="block text-sm font-semibold text-muted">
          Private · nothing here is split or visible to anyone
        </span>
      </span>
      <span aria-hidden="true" className="text-xl text-owe">
        ›
      </span>
    </Link>
  );
}
