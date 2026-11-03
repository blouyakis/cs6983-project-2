import "server-only";
import { getDb } from "./client";

export type MemberWeight = { userId: string; weight: number };

// The group and its creator's membership are written in one transaction by
// create_group. Returns the new group's id.
export async function createGroup(
  name: string,
  createdBy: string,
): Promise<string> {
  const { data, error } = await getDb().rpc("create_group", {
    p_name: name,
    p_created_by: createdBy,
  });
  if (error) {
    throw new Error(`Could not create the group: ${error.message}`);
  }
  return data as string;
}

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<void> {
  const { error } = await getDb()
    .from("groups")
    .update({ name })
    .eq("id", groupId);
  if (error) {
    throw new Error(`Could not rename the group: ${error.message}`);
  }
}

// The whole ratio in one call, so it is never half written. The service has
// already checked that weights lists exactly the current members.
export async function setMemberWeights(
  groupId: string,
  weights: readonly MemberWeight[],
): Promise<void> {
  const { error } = await getDb().rpc("set_member_weights", {
    p_group_id: groupId,
    p_weights: weights.map((entry) => ({
      user_id: entry.userId,
      weight: entry.weight,
    })),
  });
  if (error) {
    throw new Error(`Could not set the share weights: ${error.message}`);
  }
}
