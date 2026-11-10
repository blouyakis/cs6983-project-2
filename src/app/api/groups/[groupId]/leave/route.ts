import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { leaveGroup } from "@/lib/services/group-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

// The session user leaves the group (#22, AGENTS.md user flow 8). 409 while
// their balance isn't zero or a payment to or from them is still waiting; 403
// for a personal space, a former member, an archived group or a stranger.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    await leaveGroup(userId, groupId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
