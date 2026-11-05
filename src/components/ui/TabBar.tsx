import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./NavLink";

// The phone navigation along the bottom (DESIGN.md "TabBar"). Desktop uses
// AppSidebar instead, so this is hidden from the medium breakpoint up. Pages
// leave room for it with bottom padding in the signed-in layout.
export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex items-end gap-1 border-t-4 border-ink bg-sidebar px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} variant="tab" />
      ))}
    </nav>
  );
}
