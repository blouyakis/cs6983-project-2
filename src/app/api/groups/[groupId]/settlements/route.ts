import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import {
  listPastPeriods,
  startSettleUp,
} from "@/lib/services/settlement-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

// The closed periods, newest first (#19).
export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    return NextResponse.json({
      periods: await listPastPeriods(userId, groupId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Starts a settle-up on the balances at this moment and returns it with the
// fewest payments that clear them (#19). 409 while one is open.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const settleUp = await startSettleUp(userId, groupId);
    return NextResponse.json({ settleUp }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
