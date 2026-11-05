import { getSessionUserId } from "@/lib/auth/cookies";
import { listGroups } from "@/lib/services/group-service";
import { GroupLinks } from "./GroupLinks";

// Loads the user's groups for the sidebar. Reads the session, so render it
// inside <Suspense>. Without a session it renders nothing: proxy.ts has
// already sent the user to login, and the page checks again itself.
export async function SidebarGroups() {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }
  const groups = await listGroups(userId);
  // Groups the user left and archived ones are read-only history, so they
  // stay on the Groups page and out of the sidebar (AGENTS.md Section 6.6).
  const current = groups
    .filter((group) => !group.readOnly)
    .map(({ id, name, isPersonal }) => ({ id, name, isPersonal }));
  return <GroupLinks groups={current} />;
}
