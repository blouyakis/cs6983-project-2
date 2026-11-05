import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import {
  editExpense,
  removeExpense,
} from "@/lib/services/expense-edit-service";
import {
  expenseParamsSchema,
  updateExpenseSchema,
} from "@/lib/validation/expense";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string; expenseId: string }> };

// Only the payer, only while unsettled (AGENTS.md Section 6.7). The payer
// can't be changed: the body has no payer field, and one sent anyway is
// dropped by the schema.
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, expenseId } = parseInput(
      expenseParamsSchema,
      await context.params,
    );
    const input = parseInput(updateExpenseSchema, await readJson(request));
    const expense = await editExpense(userId, groupId, expenseId, input);
    return NextResponse.json({ expense });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, expenseId } = parseInput(
      expenseParamsSchema,
      await context.params,
    );
    await removeExpense(userId, groupId, expenseId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
