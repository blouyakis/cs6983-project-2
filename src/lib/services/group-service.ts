import "server-only";
import {
  addMember,
  findMembership,
  listCurrentMembers,
  listMemberships,
  rejoinMember,
  type Group,
  type Member,
} from "@/lib/db/group-members";
import {
  createGroup as insertGroup,
  renameGroup,
  setMemberWeights,
} from "@/lib/db/groups";
import { findUserByEmail } from "@/lib/db/users";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import type {
  CreateGroupInput,
  InviteInput,
  UpdateGroupInput,
} from "@/lib/validation/group";
import { requireGroupAccess } from "./access";

export type GroupDetails = Omit<Group, "createdBy"> & { members: Member[] };

// A row of the Groups page. A group the user left, or that was archived, is
// read-only (AGENTS.md Sections 6.6 and 6.8).
export type GroupSummary = GroupDetails & {
  leftAt: string | null;
  readOnly: boolean;
};

function toDetails(group: Group, members: Member[]): GroupDetails {
  return {
    id: group.id,
    name: group.name,
    isPersonal: group.isPersonal,
    archivedAt: group.archivedAt,
    createdAt: group.createdAt,
    members,
  };
}

export async function getGroup(
  userId: string,
  groupId: string,
): Promise<GroupDetails> {
  const { group } = await requireGroupAccess(userId, groupId, "read");
  return toDetails(group, await listCurrentMembers(groupId));
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
      ...toDetails(group, members),
      leftAt,
      readOnly: leftAt !== null || group.archivedAt !== null,
    }))
    .sort((a, b) => rank(a) - rank(b));
}

// Any current member can invite an existing account by email; the invitee
// joins right away (#6). A former member rejoins.
export async function inviteMember(
  userId: string,
  groupId: string,
  input: InviteInput,
): Promise<Member> {
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
  if (membership) {
    await rejoinMember(groupId, invitee.id);
  } else {
    await addMember(groupId, invitee.id);
  }
  return { userId: invitee.id, name: invitee.name, defaultShareWeight: 1 };
}

function listsExactly(
  weights: readonly { userId: string }[],
  members: readonly Member[],
): boolean {
  const current = new Set(members.map((member) => member.userId));
  return (
    weights.length === current.size &&
    weights.every((entry) => current.has(entry.userId))
  );
}

// Renames the group, sets its default ratio, or both. Weights are checked
// before anything is written, so a bad ratio doesn't leave a half-done update.
export async function updateGroup(
  userId: string,
  groupId: string,
  input: UpdateGroupInput,
): Promise<GroupDetails> {
  await requireGroupAccess(userId, groupId, "write");
  if (input.memberWeights) {
    const members = await listCurrentMembers(groupId);
    if (!listsExactly(input.memberWeights, members)) {
      throw new ValidationError("Check the highlighted fields.", {
        memberWeights: "List a weight for every current member.",
      });
    }
    await setMemberWeights(groupId, input.memberWeights);
  }
  if (input.name !== undefined) {
    await renameGroup(groupId, input.name);
  }
  return getGroup(userId, groupId);
}
