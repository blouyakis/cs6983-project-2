import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { getMyBill } from "@/lib/services/bill-service";
import { billQuerySchema, groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

// The session user's itemized bill for the group (#21, user flow 7): the
// current period, or a closed one with ?settlementId=. Always "me": the user
// comes from the session, never from the request (AGENTS.md Section 8).
export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const { settlementId } = parseInput(billQuerySchema, {
      settlementId:
        request.nextUrl.searchParams.get("settlementId") ?? undefined,
    });
    return NextResponse.json(
      await getMyBill(userId, groupId, settlementId ?? null),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
