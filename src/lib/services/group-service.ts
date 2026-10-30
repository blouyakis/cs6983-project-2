import "server-only";
import type { Group } from "@/lib/db/group-members";
import { requireGroupAccess } from "./group-access";

export type GroupDetails = Omit<Group, "createdBy">;

export async function getGroup(
  userId: string,
  groupId: string,
): Promise<GroupDetails> {
  const { group } = await requireGroupAccess(userId, groupId, "read");
  return {
    id: group.id,
    name: group.name,
    isPersonal: group.isPersonal,
    archivedAt: group.archivedAt,
    createdAt: group.createdAt,
  };
}
