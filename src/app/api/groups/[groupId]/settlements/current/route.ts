import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { getCurrentSettleUp } from "@/lib/services/settlement-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

// The open settle-up and its payments (#19). 404 when none is open.
export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    return NextResponse.json({
      settleUp: await getCurrentSettleUp(userId, groupId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
