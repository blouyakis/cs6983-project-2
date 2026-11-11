import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { declinePaymentReceived } from "@/lib/services/payment-service";
import { parseInput } from "@/lib/validation/parse";
import { paymentParamsSchema } from "@/lib/validation/payment";

type Context = { params: Promise<{ groupId: string; paymentId: string }> };

// The recipient says the money of a paid payment never arrived (#108). A
// settle-up payment comes back as suggested; a direct payment is deleted,
// which is 204. 403 for anyone else, 409 unless it is marked paid.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, paymentId } = parseInput(
      paymentParamsSchema,
      await context.params,
    );
    const payment = await declinePaymentReceived(userId, groupId, paymentId);
    if (payment === null) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ payment });
  } catch (error) {
    return toErrorResponse(error);
  }
}
