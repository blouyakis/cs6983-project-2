import "server-only";
import { ForbiddenError } from "@/lib/http/errors";
import { getGroupPeriod } from "./balance-service";
import { listGroups } from "./group-service";

// A group in the sidebar (DESIGN.md "AppSidebar").
export type SidebarGroup = {
  id: string;
  name: string;
  isPersonal: boolean;
  // The user's balance in a shared group. The personal space has none, and
  // neither does a group whose balance couldn't be loaded.
  balanceCents?: number;
};

// The groups the sidebar lists, with the user's balance in each shared one.
// The (app) layout renders them on a full load, and GET /api/sidebar-groups
// sends them again after each client navigation (#89), so both take them
// from here. Groups the user left and archived ones are read-only history,
// so they stay on the Groups page and out of the sidebar (AGENTS.md Section
// 6.6). Balances come from getGroupPeriod (#9), which checks access for each
// group; one that fails leaves its group without a balance rather than
// taking the whole sidebar down, and is logged unless the user just left.
export async function listSidebarGroups(
  userId: string,
): Promise<SidebarGroup[]> {
  const current = (await listGroups(userId)).filter((group) => !group.readOnly);
  return Promise.all(
    current.map(async ({ id, name, isPersonal }) => {
      const group: SidebarGroup = { id, name, isPersonal };
      if (isPersonal) {
        return group;
      }
      try {
        const { balances } = await getGroupPeriod(userId, id);
        const own = balances.find((balance) => balance.userId === userId);
        return { ...group, balanceCents: own?.balanceCents ?? 0 };
      } catch (error) {
        // The user left the group after listGroups read it: expected, and the
        // next navigation drops it from the sidebar.
        if (error instanceof ForbiddenError) {
          return group;
        }
        // Logged, so the fallback doesn't hide a database or code failure.
        // Only the group id and the message: never the error object, whose
        // cause can carry row values, nor a request body or token.
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Sidebar balance for group ${id} not loaded: ${message}`);
        return group;
      }
    }),
  );
}
