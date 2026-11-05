import Link from "next/link";
import type { NavItem } from "./nav-items";

type NavLinkProps = {
  item: NavItem;
  // The sidebar stacks a row per item; the tab bar stacks the emoji over a
  // small label.
  variant: "sidebar" | "tab";
  // Whether this is the page the user is on. CurrentNavLink works it out
  // from the pathname; the static shell renders with false.
  current: boolean;
};

const BASE = {
  sidebar:
    "flex items-center gap-2 rounded-lg border-2 px-3 py-2 font-semibold",
  tab: "flex flex-1 flex-col items-center gap-0.5 rounded-t-lg border-2 border-b-0 px-1 py-2 text-xs font-semibold",
};

// The current page sits on `surface` with `owe` text (DESIGN.md
// "AppSidebar" and "TabBar"), and says so to screen readers.
const CURRENT = "border-ink bg-surface text-owe";
const OTHER = "border-transparent text-ink hover:bg-surface";

// One item of the main navigation. A page that isn't built yet is text, not
// a link, so keyboard users don't tab to a dead end.
export function NavLink({ item, variant, current }: NavLinkProps) {
  const label = (
    <>
      <span aria-hidden="true" className={variant === "tab" ? "text-xl" : ""}>
        {item.emoji}
      </span>
      {item.label}
    </>
  );
  if (!item.built) {
    return (
      <span
        aria-disabled="true"
        className={`${BASE[variant]} border-transparent text-muted`}
      >
        {label}
        <span className="text-xs font-normal">(soon)</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={`${BASE[variant]} ${current ? CURRENT : OTHER}`}
    >
      {label}
    </Link>
  );
}
