export type NavItem = {
  href: string;
  label: string;
  // Decorative; hidden from screen readers next to the label.
  emoji: string;
  // Whether the page exists. An item that isn't built is shown but not
  // linked, so the navigation never leads to a 404.
  built: boolean;
};

// The four places in the sidebar and the tab bar (DESIGN.md "Navigation").
// TODO(#68): link Lists and Settle up once those pages exist.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview", emoji: "🧭", built: true },
  { href: "/lists", label: "Lists", emoji: "📝", built: false },
  { href: "/settle-up", label: "Settle up", emoji: "🤝", built: false },
  { href: "/groups", label: "Groups", emoji: "👥", built: true },
];

// Overview is only the root. Any other item is current on its page and on
// the pages under it, so Groups stays marked inside one group.
export function isCurrentPage(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
