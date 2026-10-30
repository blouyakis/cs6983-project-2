import "server-only";
import { findMembership, type Group } from "@/lib/db/group-members";
import { ForbiddenError } from "@/lib/http/errors";

export type AccessMode = "read" | "write";

export type GroupAccess = {
  group: Group;
  // For a former member: only data created before this time may be shown.
  // Null for a current member, who sees everything.
  readUntil: string | null;
};

// The one place group access is decided (AGENTS.md Section 6.6). Every service
// calls it before it reads or writes group data. A group that does not exist
// gets the same 403 as one the user is not in, so ids can't be probed.
export async function requireGroupAccess(
  userId: string,
  groupId: string,
  mode: AccessMode,
): Promise<GroupAccess> {
  const membership = await findMembership(userId, groupId);
  if (!membership) {
    throw new ForbiddenError("You are not a member of this group.");
  }
  const { group, leftAt } = membership;
  if (group.isPersonal && group.createdBy !== userId) {
    throw new ForbiddenError("You are not a member of this group.");
  }
  if (mode === "write") {
    if (leftAt) {
      throw new ForbiddenError(
        "You left this group, so you can only read its history.",
      );
    }
    if (group.archivedAt) {
      throw new ForbiddenError("This group is archived and read-only.");
    }
  }
  return { group, readUntil: leftAt };
}
