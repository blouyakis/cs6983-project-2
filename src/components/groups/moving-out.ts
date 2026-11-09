import type { Payment } from "@/lib/db/settlements";

// Whether a payment to or from the user is still suggested or paid, which
// stops them leaving (#22): leave_group refuses with pending_payment, since
// once they leave nobody could mark it paid or confirm it. A confirmed one
// is already in the balance.
export function hasWaitingPayment(
  userId: string,
  payments: readonly Pick<Payment, "fromUserId" | "toUserId" | "status">[],
): boolean {
  return payments.some(
    (payment) =>
      payment.status !== "confirmed" &&
      (payment.fromUserId === userId || payment.toUserId === userId),
  );
}
