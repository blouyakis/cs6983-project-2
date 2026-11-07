"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoneyText } from "./MoneyText";
import { isCurrentPage } from "./nav-items";

export type GroupLink = {
  id: string;
  name: string;
  isPersonal: boolean;
  // The user's balance in a shared group. The personal space has none.
  balanceCents?: number;
};

type GroupLinksProps = { groups: readonly GroupLink[] };

// The sidebar's list of the user's groups, shared ones first and the personal
// space last (DESIGN.md "AppSidebar"), each shared group with the user's
// balance in words. A group's emoji is the first character of its name, so
// the name carries it. The open group is filled with `ink`.
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
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{group.name}</span>
                {group.balanceCents === undefined ? null : (
                  // The open group is filled with ink, where the owe color is
                  // too dark to read (DESIGN.md), so its amount takes the
                  // link's own color there.
                  <span
                    data-on-ink={current ? "" : undefined}
                    className={`text-sm ${
                      current ? "[&_[data-tone]]:text-surface" : ""
                    }`}
                  >
                    <MoneyText cents={group.balanceCents} as="balance" />
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
