import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { getGroupBalances } from "@/lib/services/balance-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

// Each member's balance in cents for the current period, computed on the
// server on every request (AGENTS.md Section 6.4 and Section 8: the browser
// never recalculates balances).
export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    return NextResponse.json({
      balances: await getGroupBalances(userId, groupId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
