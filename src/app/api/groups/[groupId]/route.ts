import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { getGroup, updateGroup } from "@/lib/services/group-service";
import { parseInput } from "@/lib/validation/parse";
import { groupParamsSchema, updateGroupSchema } from "@/lib/validation/group";

type Context = { params: Promise<{ groupId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const group = await getGroup(userId, groupId);
    return NextResponse.json({ group });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Renames the group, sets each member's default share weight, or both.
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const input = parseInput(updateGroupSchema, await readJson(request));
    const group = await updateGroup(userId, groupId, input);
    return NextResponse.json({ group });
  } catch (error) {
    return toErrorResponse(error);
  }
}
