import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { listExpenseHistory } from "@/lib/services/expense-history-service";
import { expenseHistoryQuerySchema } from "@/lib/validation/expense";
import { parseInput } from "@/lib/validation/parse";

// The session user's expense history (#15, user story 1): every expense they
// share, across their groups and personal space, newest first. ?groupId=,
// ?paidBy=, ?from= and ?to= narrow it, in any combination. The user comes
// from the session, never from the request (AGENTS.md Section 8).
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const query = request.nextUrl.searchParams;
    const filters = parseInput(expenseHistoryQuerySchema, {
      groupId: query.get("groupId"),
      paidBy: query.get("paidBy"),
      from: query.get("from"),
      to: query.get("to"),
    });
    return NextResponse.json({
      expenses: await listExpenseHistory(userId, filters),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
