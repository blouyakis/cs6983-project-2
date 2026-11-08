"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

// AppSidebar is `hidden md:flex`, and Tailwind's md breakpoint is 48rem.
const SIDEBAR_SHOWN = "(min-width: 48rem)";

// Below md the sidebar is hidden but still mounted, so an answer would never
// be seen. Without matchMedia, assume it is shown.
function sidebarShown() {
  return (
    typeof window.matchMedia !== "function" ||
    window.matchMedia(SIDEBAR_SHOWN).matches
  );
}

function withoutBalance({ id, name, isPersonal }: GroupLink): GroupLink {
  return { id, name, isPersonal };
}

// The (app) layout renders `groups` on a full load and again after
// router.refresh(), but not on client navigation, so a change another member
// made would stay out of the sidebar while the page shows it (#89). After
// each navigation this asks GET /api/sidebar-groups again. A navigation that
// starts before the last answer arrives cancels it, so a late answer never
// replaces a newer one, and so do new groups from router.refresh(): an answer
// still on its way may predate the change that refresh shows. If the request
// fails, the groups stay listed without balances rather than with ones that
// may be stale.
function useCurrentGroups(groups: readonly GroupLink[]) {
  const pathname = usePathname();
  const [rendered, setRendered] = useState(groups);
  const [shown, setShown] = useState(groups);
  if (groups !== rendered) {
    setRendered(groups);
    setShown(groups);
  }
  const loadedFor = useRef(pathname);
  useEffect(() => {
    if (pathname === loadedFor.current) {
      return;
    }
    loadedFor.current = pathname;
    // A phone shows TabBar instead. If the window then widens, the sidebar
    // catches up at the next navigation.
    if (!sidebarShown()) {
      return;
    }
    const controller = new AbortController();
    let stale = false;
    async function load() {
      try {
        const response = await fetch("/api/sidebar-groups", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`GET /api/sidebar-groups: ${response.status}`);
        }
        const body = (await response.json()) as { groups?: GroupLink[] };
        if (!Array.isArray(body.groups)) {
          throw new Error("GET /api/sidebar-groups: no groups");
        }
        const next = body.groups;
        if (!stale) {
          setShown(next);
        }
      } catch {
        if (!stale) {
          setShown((current) => current.map(withoutBalance));
        }
      }
    }
    void load();
    return () => {
      stale = true;
      controller.abort();
    };
    // `groups` only changes when the layout renders again, after
    // router.refresh(): the cleanup then cancels the request, and the early
    // return above keeps it from starting another.
  }, [pathname, groups]);
  return { pathname, groups: shown };
}

// The sidebar's list of the user's groups, shared ones first and the personal
// space last (DESIGN.md "AppSidebar"), each shared group with the user's
// balance in words. A group's emoji is the first character of its name, so
// the name carries it. The open group is filled with `ink`.
export function GroupLinks(props: GroupLinksProps) {
  const { pathname, groups } = useCurrentGroups(props.groups);
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
