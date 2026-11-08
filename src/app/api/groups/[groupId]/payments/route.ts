import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import {
  listPayments,
  recordDirectPayment,
} from "@/lib/services/payment-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";
import { createPaymentSchema } from "@/lib/validation/payment";

type Context = { params: Promise<{ groupId: string }> };

// The group's paid and confirmed payments, last paid first (#14).
export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    return NextResponse.json({ payments: await listPayments(userId, groupId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Records a direct payment from the session user (#14). The body has no
// sender field, and one sent anyway is dropped by the schema.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const input = parseInput(createPaymentSchema, await readJson(request));
    const payment = await recordDirectPayment(userId, groupId, input);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
