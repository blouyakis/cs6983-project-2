import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { confirmPaymentReceived } from "@/lib/services/payment-service";
import { parseInput } from "@/lib/validation/parse";
import { paymentParamsSchema } from "@/lib/validation/payment";

type Context = { params: Promise<{ groupId: string; paymentId: string }> };

// The recipient confirms a paid payment (#14, #19). `closed` says whether it
// was the last one of an open settle-up, which then closed. 403 for anyone
// else, 409 unless it is marked paid.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, paymentId } = parseInput(
      paymentParamsSchema,
      await context.params,
    );
    const { payment, closed } = await confirmPaymentReceived(
      userId,
      groupId,
      paymentId,
    );
    return NextResponse.json({ payment, closed });
  } catch (error) {
    return toErrorResponse(error);
  }
}
