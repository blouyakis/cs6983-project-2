import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { getGroup } from "@/lib/services/group-service";
import { parseInput } from "@/lib/validation/parse";
import { groupParamsSchema } from "@/lib/validation/group";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const group = await getGroup(userId, groupId);
    return NextResponse.json({ group });
  } catch (error) {
    return toErrorResponse(error);
  }
}
