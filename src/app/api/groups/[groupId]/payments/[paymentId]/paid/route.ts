import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { markPaymentSent } from "@/lib/services/payment-service";
import { parseInput } from "@/lib/validation/parse";
import { paymentParamsSchema } from "@/lib/validation/payment";

type Context = { params: Promise<{ groupId: string; paymentId: string }> };

// The sender marks a suggested payment paid (#19). 403 for anyone else, 409
// once it is paid or confirmed.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, paymentId } = parseInput(
      paymentParamsSchema,
      await context.params,
    );
    const payment = await markPaymentSent(userId, groupId, paymentId);
    return NextResponse.json({ payment });
  } catch (error) {
    return toErrorResponse(error);
  }
}
