import "server-only";
import { getDb } from "./client";

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

const MEMBERSHIP_COLUMNS =
  "joined_at, left_at, groups!inner(id, name, is_personal, created_by, archived_at, created_at)";

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
    group: {
      id: data.groups.id,
      name: data.groups.name,
      isPersonal: data.groups.is_personal,
      createdBy: data.groups.created_by,
      archivedAt: data.groups.archived_at,
      createdAt: data.groups.created_at,
    },
  };
}
