import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NewGroupButton } from "@/components/groups/NewGroupButton";
import { NAV_ITEMS } from "./nav-items";
import { CurrentNavLink } from "./CurrentNavLink";
import { NavLink } from "./NavLink";

type AppSidebarProps = {
  // The user's group links, rendered by the server (SidebarGroups) so this
  // shell stays free of data loading.
  children?: ReactNode;
};

// The desktop navigation (DESIGN.md "AppSidebar"): the logo, the page links,
// the user's groups, then New group. Phones get TabBar instead, so this is
// hidden below the medium breakpoint.
export function AppSidebar({ children }: AppSidebarProps) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r-4 border-ink bg-sidebar p-4 md:flex"
    >
      <Link href="/" className="text-2xl font-bold">
        <span aria-hidden="true">🗂️ </span>LifeBoard
      </Link>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Suspense
              fallback={
                <NavLink item={item} variant="sidebar" current={false} />
              }
            >
              <CurrentNavLink item={item} variant="sidebar" />
            </Suspense>
          </li>
        ))}
      </ul>
      {children}
      <div className="mt-auto">
        <NewGroupButton />
      </div>
    </nav>
  );
}
