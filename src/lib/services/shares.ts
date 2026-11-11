import "server-only";
import { listCurrentMemberWeights } from "@/lib/db/group-members";
import {
  checkCustomShares,
  splitByWeights,
  type Share,
} from "@/lib/domain/splits";
import { ValidationError } from "@/lib/http/errors";
import type { SplitInput } from "@/lib/validation/splits";

// The shares of a new cost paid by the current user in a group: adding an
// expense (#7) and checking off a list item (#12) split the same way
// (AGENTS.md Sections 6.2 and 6.3). Splitting is done here, in lib/domain,
// never trusted from the request.
export async function sharesOfNewCost(
  payerId: string,
  groupId: string,
  amountCents: number,
  split: SplitInput,
): Promise<Share[]> {
  // Only current members share a new cost. create_expense and
  // complete_list_item refuse a member who has left too (member_left, #22),
  // for a leave that lands between this check and the write; checking here
  // first gives a 400 on the field instead of a 409.
  const current = new Set(
    (await listCurrentMemberWeights(groupId)).map((member) => member.userId),
  );
  if (!split.sharedBy.every((sharerId) => current.has(sharerId))) {
    throw new ValidationError("Check the highlighted fields.", {
      sharedBy: "Everyone sharing this cost must be in the group.",
    });
  }

  // The server's even mode is always 1:1. A group's ratio reaches a cost
  // through SplitEditor, as custom amounts (AGENTS.md Section 6.3).
  return split.mode === "even"
    ? splitByWeights(
        amountCents,
        payerId,
        split.sharedBy.map((sharerId) => ({ userId: sharerId, weight: 1 })),
      )
    : checkCustomShares(
        amountCents,
        payerId,
        split.sharedBy,
        split.amountsCents,
      );
}
