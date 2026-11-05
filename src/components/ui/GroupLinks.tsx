"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentPage } from "./nav-items";

export type GroupLink = { id: string; name: string; isPersonal: boolean };

type GroupLinksProps = { groups: readonly GroupLink[] };

// The sidebar's list of the user's groups, shared ones first and the personal
// space last (DESIGN.md "AppSidebar"). A group's emoji is the first character
// of its name, so the name carries it. The open group is filled with `ink`.
export function GroupLinks({ groups }: GroupLinksProps) {
  const pathname = usePathname();
  if (groups.length === 0) {
    return null;
  }
  const ordered = [
    ...groups.filter((group) => !group.isPersonal),
    ...groups.filter((group) => group.isPersonal),
  ];
  return (
    <ul aria-label="Your groups" className="flex flex-col gap-1">
      {ordered.map((group) => {
        const href = `/groups/${group.id}`;
        const current = isCurrentPage(pathname, href);
        return (
          <li key={group.id}>
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 font-semibold ${
                current ? "bg-ink text-surface" : "hover:bg-surface"
              }`}
            >
              <span className="truncate">{group.name}</span>
              {/* TODO(#9): add the user's balance in words with MoneyText. */}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
