"use client";

import { usePathname } from "next/navigation";
import { isCurrentPage, type NavItem } from "./nav-items";
import { NavLink } from "./NavLink";

type CurrentNavLinkProps = {
  item: NavItem;
  variant: "sidebar" | "tab";
};

// NavLink with `current` read from the pathname. Reading the pathname in a
// Client Component suspends while Next prerenders a route with dynamic
// params, so the parent wraps this in <Suspense> with the plain NavLink as
// the fallback and the marking streams in (Next docs, "Migrating to Cache
// Components").
export function CurrentNavLink({ item, variant }: CurrentNavLinkProps) {
  const pathname = usePathname();
  return (
    <NavLink
      item={item}
      variant={variant}
      current={isCurrentPage(pathname, item.href)}
    />
  );
}
