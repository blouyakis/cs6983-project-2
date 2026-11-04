import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { addExpense, listGroupExpenses } from "@/lib/services/expense-service";
import { createExpenseSchema } from "@/lib/validation/expense";
import { groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    return NextResponse.json({
      expenses: await listGroupExpenses(userId, groupId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// The payer is the session user. The body has no payer field, and one sent
// anyway is dropped by the schema.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const input = parseInput(createExpenseSchema, await readJson(request));
    const expense = await addExpense(userId, groupId, input);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
