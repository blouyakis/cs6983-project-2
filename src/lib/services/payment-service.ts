import "server-only";
import { listCurrentMembers } from "@/lib/db/group-members";
import {
  confirmPayment,
  deleteDirectPayment,
  findPayment,
  listGroupPayments,
  markPaymentPaid,
  recordPayment,
  type Payment,
  unmarkPaymentPaid,
} from "@/lib/db/settlements";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import type { CreatePaymentInput } from "@/lib/validation/payment";
import { requireGroupAccess } from "./access";

export type { Payment };

// The payment lifecycle (architecture.md "Payment lifecycle"): the sender
// says "I sent it", the recipient says "I got it", and only the recipient's
// confirmation changes balances.

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

// The recipient of a paid payment says the money never arrived (#108). A
// settle-up payment goes back to suggested and is returned, so the payer can
// mark it again and the settle-up can be cancelled again. A direct payment
// never counted in a balance, so it is deleted and this returns null.
export async function declinePaymentReceived(
  userId: string,
  groupId: string,
  paymentId: string,
): Promise<Payment | null> {
  const payment = await requirePayment(userId, groupId, paymentId);
  if (payment.toUserId !== userId) {
    throw new ForbiddenError(
      "Only the person receiving the money can decline it.",
    );
  }
  if (payment.status !== "paid") {
    throw new ConflictError(
      payment.status === "confirmed"
        ? "This payment is already confirmed."
        : "This payment hasn't been marked paid yet.",
    );
  }
  // A paid payment keeps its settlement_id, so this picks the right write.
  // Each write refuses a payment that is no longer paid, so a confirm that
  // landed in between wins and this is a 409.
  if (payment.settlementId === null) {
    if (!(await deleteDirectPayment(paymentId))) {
      throw new ConflictError("This payment is no longer marked paid.");
    }
    return null;
  }
  const declined = await unmarkPaymentPaid(paymentId);
  if (!declined) {
    throw new ConflictError("This payment is no longer marked paid.");
  }
  return declined;
}

// A member records money they sent another current member outside the app
// (#14, user flow 6). The sender is always the current user, never an id from
// the request. It starts as paid and counts once the recipient confirms it.
export async function recordDirectPayment(
  userId: string,
  groupId: string,
  input: CreatePaymentInput,
): Promise<Payment> {
  await requireGroupAccess(userId, groupId, "write");
  if (input.toUserId === userId) {
    throw new ValidationError("Check the highlighted fields.", {
      toUserId: "You can't pay yourself.",
    });
  }
  const members = await listCurrentMembers(groupId);
  if (!members.some((member) => member.userId === input.toUserId)) {
    throw new ValidationError("Check the highlighted fields.", {
      toUserId: "Choose a current member of this group.",
    });
  }
  return recordPayment(groupId, userId, input.toUserId, input.amountCents);
}

// The group's paid and confirmed payments, last paid first (#14). A former
// member only sees the ones created before they left (AGENTS.md Section 6.6).
export async function listPayments(
  userId: string,
  groupId: string,
): Promise<Payment[]> {
  const { readUntil } = await requireGroupAccess(userId, groupId, "read");
  return listGroupPayments(groupId, readUntil);
}
