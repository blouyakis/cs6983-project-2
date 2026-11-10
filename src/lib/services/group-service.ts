import "server-only";
import {
  addMember,
  findMembership,
  leaveGroup as leaveMembership,
  listCurrentMembers,
  listMembersAt,
  listMemberships,
  type Group,
  type Member,
} from "@/lib/db/group-members";
import {
  createGroup as insertGroup,
  updateGroup as writeGroupChanges,
} from "@/lib/db/groups";
import { findUserByEmail } from "@/lib/db/users";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import type {
  CreateGroupInput,
  InviteInput,
  UpdateGroupInput,
} from "@/lib/validation/group";
import { requireGroupAccess } from "./access";

// readOnly is true when the user left the group or it was archived (AGENTS.md
// Sections 6.6 and 6.8), so pages can leave out forms that would get a 403.
export type GroupDetails = Omit<Group, "createdBy"> & {
  readOnly: boolean;
  members: Member[];
};

// A row of the Groups page, which also says when the user left.
export type GroupSummary = GroupDetails & { leftAt: string | null };

function toDetails(
  group: Group,
  leftAt: string | null,
  members: Member[],
): GroupDetails {
  return {
    id: group.id,
    name: group.name,
    isPersonal: group.isPersonal,
    archivedAt: group.archivedAt,
    createdAt: group.createdAt,
    readOnly: leftAt !== null || group.archivedAt !== null,
    members,
  };
}

export async function getGroup(
  userId: string,
  groupId: string,
): Promise<GroupDetails> {
  const { group, readUntil } = await requireGroupAccess(
    userId,
    groupId,
    "read",
  );
  // A former member sees the members as they were when they left (AGENTS.md
  // 6.6), not people who joined later.
  return toDetails(group, readUntil, await listMembersAt(groupId, readUntil));
}

export async function createGroup(
  userId: string,
  input: CreateGroupInput,
): Promise<GroupDetails> {
  const groupId = await insertGroup(input.name, userId);
  return getGroup(userId, groupId);
}

// The personal space first, then the groups the user can write to, then the
// read-only ones, each in the order the user joined.
function rank(summary: GroupSummary): number {
  if (summary.isPersonal) {
    return 0;
  }
  return summary.readOnly ? 2 : 1;
}

export async function listGroups(userId: string): Promise<GroupSummary[]> {
  const memberships = await listMemberships(userId);
  return memberships
    .map(({ group, leftAt, members }) => ({
      ...toDetails(group, leftAt, members),
      leftAt,
    }))
    .sort((a, b) => rank(a) - rank(b));
}

// What an invitation gives back: the new member, and whether their joining
// reset the group's uneven split to even, so the invite form can say so (#63).
export type Invitation = { member: Member; splitReset: boolean };

// Any current member can invite an existing account by email; the invitee
// joins right away (#6). A former member rejoins. The database gives them a
// weight in the same transaction (#63).
export async function inviteMember(
  userId: string,
  groupId: string,
  input: InviteInput,
): Promise<Invitation> {
  const { group } = await requireGroupAccess(userId, groupId, "write");
  if (group.isPersonal) {
    throw new ForbiddenError("A personal space can't have other members.");
  }
  const invitee = await findUserByEmail(input.email);
  if (!invitee) {
    throw new NotFoundError("No LifeBoard account uses that email.");
  }
  const membership = await findMembership(invitee.id, groupId);
  if (membership && membership.leftAt === null) {
    throw new ConflictError("They are already in this group.");
  }
  const { weight, splitReset } = await addMember(groupId, invitee.id);
  return {
    member: {
      userId: invitee.id,
      name: invitee.name,
      defaultShareWeight: weight,
    },
    splitReset,
  };
}

// Renames the group, sets its default ratio, or both. The database checks that
// the weights list exactly the current members in the same transaction that
// writes them, so a bad ratio changes nothing, and a 400 comes back from there.
export async function updateGroup(
  userId: string,
  groupId: string,
  input: UpdateGroupInput,
): Promise<GroupDetails> {
  const { group } = await requireGroupAccess(userId, groupId, "write");
  // Its name is the fixed "Personal space" and its owner's weight only fills
  // the column, so there is nothing to change (#23).
  if (group.isPersonal) {
    throw new ForbiddenError(
      "A personal space has no name or split to change.",
    );
  }
  await writeGroupChanges(groupId, input);
  // Write access means a current member of an active group, so readUntil is
  // null and the access check doesn't need to run again.
  const members = await listCurrentMembers(groupId);
  return toDetails({ ...group, name: input.name ?? group.name }, null, members);
}

// The user leaves the group (#22, AGENTS.md user flow 8). Write access means a
// current member of an active group, so a former member, an archived group
// and a stranger get 403 here. A personal space can't be left: its owner
// would lose their own space (#81 review). The database checks the balance,
// the waiting payments and the personal space again under its locks, sets
// left_at, and archives the group when they were the last member.
export async function leaveGroup(
  userId: string,
  groupId: string,
): Promise<void> {
  const { group } = await requireGroupAccess(userId, groupId, "write");
  if (group.isPersonal) {
    throw new ForbiddenError("You can't leave your personal space.");
  }
  await leaveMembership(groupId, userId);
}
