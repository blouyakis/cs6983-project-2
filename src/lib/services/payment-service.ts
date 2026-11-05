import "server-only";
import {
  confirmPayment,
  findPayment,
  markPaymentPaid,
  type Payment,
} from "@/lib/db/settlements";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import { requireGroupAccess } from "./access";

export type { Payment };

// The payment lifecycle (architecture.md "Payment lifecycle"): the sender
// says "I sent it", the recipient says "I got it", and only the recipient's
// confirmation changes balances. Recording a direct payment is #14.

// The payment, once the user may act on it. A payment in another group gets
// the same 404 as an unknown one, so ids can't be probed.
async function requirePayment(
  userId: string,
  groupId: string,
  paymentId: string,
): Promise<Payment> {
  await requireGroupAccess(userId, groupId, "write");
  const payment = await findPayment(paymentId);
  if (!payment || payment.groupId !== groupId) {
    throw new NotFoundError("This payment doesn't exist.");
  }
  return payment;
}

// The sender marks a suggested payment paid (#19).
export async function markPaymentSent(
  userId: string,
  groupId: string,
  paymentId: string,
): Promise<Payment> {
  const payment = await requirePayment(userId, groupId, paymentId);
  if (payment.fromUserId !== userId) {
    throw new ForbiddenError("Only the person paying can mark this paid.");
  }
  if (payment.status !== "suggested") {
    throw new ConflictError("This payment is already marked paid.");
  }
  const marked = await markPaymentPaid(paymentId);
  if (!marked) {
    throw new ConflictError("This payment is already marked paid.");
  }
  return marked;
}

// The recipient confirms a paid payment (#14, #19). When it was the last one
// of an open settle-up, the period closed with it.
export async function confirmPaymentReceived(
  userId: string,
  groupId: string,
  paymentId: string,
): Promise<{ payment: Payment; closed: boolean }> {
  const payment = await requirePayment(userId, groupId, paymentId);
  if (payment.toUserId !== userId) {
    throw new ForbiddenError(
      "Only the person receiving the money can confirm it.",
    );
  }
  if (payment.status !== "paid") {
    throw new ConflictError(
      payment.status === "confirmed"
        ? "This payment is already confirmed."
        : "This payment hasn't been marked paid yet.",
    );
  }
  const closed = await confirmPayment(paymentId);
  const confirmed = await findPayment(paymentId);
  if (!confirmed) {
    throw new Error("The confirmed payment could not be loaded.");
  }
  return { payment: confirmed, closed };
}
