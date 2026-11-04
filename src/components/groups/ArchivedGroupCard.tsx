import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { GroupSummary } from "@/lib/services/group-service";
import { formatDay } from "./format-day";
import { GroupTile } from "./GroupTile";

// A group the user left, or that was archived after everyone left. It stays
// readable up to that day (DESIGN.md "ArchivedGroupCard").
function explain(group: GroupSummary): string {
  if (group.leftAt) {
    return `You left ${formatDay(group.leftAt)} · you can read everything up to that day, add nothing`;
  }
  return `Archived ${formatDay(group.archivedAt ?? group.createdAt)} · everyone has left, you can read its history`;
}

export function ArchivedGroupCard({ group }: { group: GroupSummary }) {
  return (
    <article className="rounded-2xl border-4 border-dashed border-muted bg-surface p-4">
      <Link
        href={`/groups/${group.id}`}
        className="flex flex-wrap items-center gap-3"
      >
        <GroupTile name={group.name} />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold">{group.name}</span>
          <span className="block text-sm font-semibold text-muted">
            {explain(group)}
          </span>
        </span>
        <Badge>Read only</Badge>
      </Link>
    </article>
  );
}
