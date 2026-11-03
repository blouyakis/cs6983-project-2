import "server-only";
import type { Sharer } from "@/lib/domain/splits";
import { ConflictError } from "@/lib/http/errors";
import { getDb } from "./client";

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

// A current member of a group, as other members see them.
export type Member = {
  userId: string;
  name: string;
  defaultShareWeight: number;
};

const GROUP_COLUMNS =
  "id, name, is_personal, created_by, archived_at, created_at";
const MEMBERSHIP_COLUMNS = `joined_at, left_at, groups!inner(${GROUP_COLUMNS})`;
const MEMBER_COLUMNS =
  "user_id, default_share_weight, joined_at, left_at, users!inner(name)";

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

// Current members only, in the order they joined.
function toCurrentMembers(rows: MemberRow[]): Member[] {
  return rows
    .filter((row) => row.left_at === null)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
    .map(toMember);
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

type WeightRow = { user_id: string; default_share_weight: number };

// Each current member's default share weight, which a new expense in the group
// is split by unless the payer enters custom amounts (#8).
export async function listCurrentMemberWeights(
  groupId: string,
): Promise<Sharer[]> {
  const { data, error } = await getDb()
    .from("group_members")
    .select("user_id, default_share_weight")
    .eq("group_id", groupId)
    .is("left_at", null)
    .order("joined_at");
  if (error) {
    throw new Error(`Could not load share weights: ${error.message}`);
  }
  return (data as WeightRow[]).map((row) => ({
    userId: row.user_id,
    weight: row.default_share_weight,
  }));
}

// The group's current members with their names, for the member list and for
// SplitEditor, which fills in custom amounts from defaultShareWeight (#8).
export async function listCurrentMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await getDb()
    .from("group_members")
    .select(MEMBER_COLUMNS)
    .eq("group_id", groupId)
    .is("left_at", null)
    .order("joined_at");
  if (error) {
    throw new Error(`Could not load members: ${error.message}`);
  }
  return (data as unknown as MemberRow[]).map(toMember);
}

type MembershipWithMembersRow = {
  joined_at: string;
  left_at: string | null;
  groups: GroupRow & { group_members: MemberRow[] };
};

// Every group the user is or was in, each with its current members. A group
// the user left keeps its row, with leftAt set.
export async function listMemberships(
  userId: string,
): Promise<(Membership & { members: Member[] })[]> {
  const { data, error } = await getDb()
    .from("group_members")
    .select(
      `joined_at, left_at, groups!inner(${GROUP_COLUMNS}, group_members(${MEMBER_COLUMNS}))`,
    )
    .eq("user_id", userId)
    .order("joined_at");
  if (error) {
    throw new Error(`Could not load groups: ${error.message}`);
  }
  return (data as unknown as MembershipWithMembersRow[]).map((row) => ({
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    group: toGroup(row.groups),
    members: toCurrentMembers(row.groups.group_members),
  }));
}

// A new member starts at weight 1, an even split (#6).
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
// one row, so joined_at becomes the time of this join.
export async function rejoinMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await getDb()
    .from("group_members")
    .update({
      left_at: null,
      joined_at: new Date().toISOString(),
      default_share_weight: 1,
    })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .not("left_at", "is", null);
  if (error) {
    throw toJoinError(error);
  }
}
