import "server-only";
import { ValidationError } from "@/lib/http/errors";
import { getDb } from "./client";

const INVALID_PARAMETER_VALUE = "22023";

export type MemberWeight = { userId: string; weight: number };

export type GroupChanges = {
  name?: string;
  memberWeights?: readonly MemberWeight[];
};

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

// Renames the group, sets its default ratio, or both, in one transaction.
// update_group checks there that the weights list exactly the current
// members, so nothing is written if they don't.
export async function updateGroup(
  groupId: string,
  changes: GroupChanges,
): Promise<void> {
  const { error } = await getDb().rpc("update_group", {
    p_group_id: groupId,
    p_name: changes.name ?? null,
    p_weights:
      changes.memberWeights?.map((entry) => ({
        user_id: entry.userId,
        weight: entry.weight,
      })) ?? null,
  });
  if (error?.code === INVALID_PARAMETER_VALUE) {
    throw new ValidationError("Check the highlighted fields.", {
      memberWeights: "List a weight for every current member.",
    });
  }
  if (error) {
    throw new Error(`Could not update the group: ${error.message}`);
  }
}
