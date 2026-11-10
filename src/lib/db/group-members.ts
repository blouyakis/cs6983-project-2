import "server-only";
import type { Sharer } from "@/lib/domain/splits";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import { getDb } from "./client";
import { toMicros } from "./timestamps";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

type GroupRow = {
  id: string;
  name: string;
  is_personal: boolean;
  created_by: string;
  archived_at: string | null;
  created_at: string;
};

type MembershipRow = {
  joined_at: string;
  left_at: string | null;
  groups: GroupRow;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  default_share_weight: number;
  joined_at: string;
  left_at: string | null;
  users: { name: string };
};

export type Group = {
  id: string;
  name: string;
  isPersonal: boolean;
  createdBy: string;
  archivedAt: string | null;
  createdAt: string;
};

// A row of group_members with its group. A former member keeps their row, with
// leftAt set.
export type Membership = {
  group: Group;
  joinedAt: string;
  leftAt: string | null;
};

// A member of a group, as other members see them.
export type Member = {
  userId: string;
  name: string;
  defaultShareWeight: number;
};

const GROUP_COLUMNS =
  "id, name, is_personal, created_by, archived_at, created_at";
const MEMBERSHIP_COLUMNS = `joined_at, left_at, groups!inner(${GROUP_COLUMNS})`;
const MEMBER_COLUMNS =
  "group_id, user_id, default_share_weight, joined_at, left_at, users!inner(name)";

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    isPersonal: row.is_personal,
    createdBy: row.created_by,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

function toMember(row: MemberRow): Member {
  return {
    userId: row.user_id,
    name: row.users.name,
    defaultShareWeight: row.default_share_weight,
  };
}

// The trigger from #40 and the primary key on (group_id, user_id) both reject
// a join; the service shows either as a 409.
function toJoinError(error: { code: string; message: string }): Error {
  if (error.code === CHECK_VIOLATION && error.message.includes("at most 12")) {
    return new ConflictError("A group can have at most 12 members.");
  }
  if (error.code === UNIQUE_VIOLATION) {
    return new ConflictError("They are already in this group.");
  }
  return new Error(`Could not add the member: ${error.message}`);
}

export async function findMembership(
  userId: string,
  groupId: string,
): Promise<Membership | null> {
  const { data, error } = await getDb()
    .from("group_members")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .maybeSingle<MembershipRow>();
  if (error) {
    throw new Error(`Could not load group membership: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  return {
    joinedAt: data.joined_at,
    leftAt: data.left_at,
    group: toGroup(data.groups),
  };
}

// Who counts as a member at a moment: at null means now, so a current member.
// For a former member's view, `at` is their left_at, and the members are the
// ones who had joined by then and hadn't left before it, themselves included.
// This is the only place in lib/db that decides membership, so the Groups
// page, the member list and splitting an expense always agree. Times are
// compared to the microsecond, as Postgres compares the other cut-offs (#75).
function isMemberAt(row: MemberRow, at: string | null): boolean {
  if (at === null) {
    return row.left_at === null;
  }
  const moment = toMicros(at);
  return (
    toMicros(row.joined_at) <= moment &&
    (row.left_at === null || toMicros(row.left_at) >= moment)
  );
}

// Every member row of the given groups, oldest first, in one query.
async function getMemberRows(
  groupIds: readonly string[],
  failure: string,
): Promise<MemberRow[]> {
  const { data, error } = await getDb()
    .from("group_members")
    .select(MEMBER_COLUMNS)
    .in("group_id", groupIds)
    .order("joined_at");
  if (error) {
    throw new Error(`${failure}: ${error.message}`);
  }
  return data as unknown as MemberRow[];
}

function toSharer(row: MemberRow): Sharer {
  return { userId: row.user_id, weight: row.default_share_weight };
}

// Each current member's default share weight, which a new expense in the group
// is split by unless the payer enters custom amounts (#8).
export async function listCurrentMemberWeights(
  groupId: string,
): Promise<Sharer[]> {
  const rows = await getMemberRows([groupId], "Could not load share weights");
  return rows.filter((row) => isMemberAt(row, null)).map(toSharer);
}

// The group's members at a moment, in the order they joined: the current
// members when `at` is null, or the members when a former member left
// (AGENTS.md 6.6). SplitEditor fills in custom amounts from
// defaultShareWeight (#8).
export async function listMembersAt(
  groupId: string,
  at: string | null,
): Promise<Member[]> {
  const rows = await getMemberRows([groupId], "Could not load members");
  return rows.filter((row) => isMemberAt(row, at)).map(toMember);
}

export function listCurrentMembers(groupId: string): Promise<Member[]> {
  return listMembersAt(groupId, null);
}

// Every group the user is or was in, each with its members: the current ones,
// or for a group the user left, the ones as they were when they left. Two
// queries however many groups there are.
export async function listMemberships(
  userId: string,
): Promise<(Membership & { members: Member[] })[]> {
  const { data, error } = await getDb()
    .from("group_members")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId)
    .order("joined_at");
  if (error) {
    throw new Error(`Could not load groups: ${error.message}`);
  }
  const memberships = data as unknown as MembershipRow[];
  if (memberships.length === 0) {
    return [];
  }
  const rows = await getMemberRows(
    memberships.map((row) => row.groups.id),
    "Could not load members",
  );
  return memberships.map((row) => ({
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    group: toGroup(row.groups),
    members: rows
      .filter(
        (member) =>
          member.group_id === row.groups.id && isMemberAt(member, row.left_at),
      )
      .map(toMember),
  }));
}

// A new member starts at weight 1, an even split (#6).
// TODO(#63): give the newcomer the shared weight when every weight is equal,
// or reset the group to 1 when they differ, in one SQL function with the join.
export async function addMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await getDb()
    .from("group_members")
    .insert({ group_id: groupId, user_id: userId, default_share_weight: 1 });
  if (error) {
    throw toJoinError(error);
  }
}

// A former member who is invited again joins from now, at weight 1. They keep
// one row, so joined_at becomes the time of this join, from the database's
// clock (#75).
// TODO(#63): follow the same weight rule as addMember, in rejoin_member.
export async function rejoinMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await getDb().rpc("rejoin_member", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) {
    throw toJoinError(error);
  }
}

// Each refusal leave_group gives, by its hint, as the error the client gets.
const LEAVE_REFUSALS: Record<string, () => Error> = {
  nonzero_balance: () =>
    new ConflictError(
      "Settle up first: you can leave once your balance in this group is $0.00.",
    ),
  pending_payment: () =>
    new ConflictError(
      "A payment to or from you is still waiting to be paid or confirmed, so you can't leave yet.",
    ),
  personal_space: () =>
    new ForbiddenError("You can't leave your personal space."),
  not_member: () => new ForbiddenError("You are not a member of this group."),
};

// The member leaves the group in one transaction through leave_group (#22):
// only at a zero balance with no payment to or from them still waiting, with
// left_at from the database's clock (#75), and the group archived when they
// were its last current member (AGENTS.md Section 6.8).
export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await getDb().rpc("leave_group", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) {
    const refusal = error.hint ? LEAVE_REFUSALS[error.hint] : undefined;
    if (refusal) {
      throw refusal();
    }
    throw new Error(`Could not leave the group: ${error.message}`);
  }
}
