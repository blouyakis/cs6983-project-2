import { getSessionUserId } from "@/lib/auth/cookies";
import { listSidebarGroups } from "@/lib/services/sidebar-service";
import { GroupLinks } from "./GroupLinks";

// Loads the user's groups for the sidebar on a full page load. Reads the
// session, so render it inside <Suspense>. Without a session it renders
// nothing: proxy.ts has already sent the user to login, and the page checks
// again itself. GroupLinks asks for them again after each client navigation
// (#89), because this layout isn't rendered again then.
export async function SidebarGroups() {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }
  // Each shared group's balance comes from the server (#9), never the browser.
  return <GroupLinks groups={await listSidebarGroups(userId)} />;
}
