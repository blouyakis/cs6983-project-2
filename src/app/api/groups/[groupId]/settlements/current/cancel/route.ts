import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { cancelSettleUp } from "@/lib/services/settlement-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

// Cancels the open settle-up while every payment is still suggested (#19).
// 409 once one is marked paid, 404 with none open.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    await cancelSettleUp(userId, groupId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
