import { Suspense, type ReactNode } from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";
import { SidebarGroups } from "@/components/ui/SidebarGroups";
import { TabBar } from "@/components/ui/TabBar";

// Every signed-in page sits beside AppSidebar on desktop and above TabBar on
// a phone (DESIGN.md "Navigation"). The bottom padding keeps the last of a
// page clear of the fixed tab bar.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar>
        <Suspense fallback={null}>
          <SidebarGroups />
        </Suspense>
      </AppSidebar>
      <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
        {children}
      </div>
      <TabBar />
    </div>
  );
}
