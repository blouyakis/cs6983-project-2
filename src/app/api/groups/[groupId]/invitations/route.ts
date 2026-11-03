import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { inviteMember } from "@/lib/services/group-service";
import { groupParamsSchema, inviteSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

// The invitee joins right away; there is no invitations table (#6).
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const input = parseInput(inviteSchema, await readJson(request));
    const member = await inviteMember(userId, groupId, input);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
