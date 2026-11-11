import type { Payment } from "@/lib/db/settlements";
import { formatCents } from "@/lib/domain/money";

// What the viewer can do to a payment: the sender marks a suggested one paid,
// the recipient confirms a paid one.
export type PaymentAction = "paid" | "confirmed";

export type PaymentDescription = {
  // "You" for the viewer, otherwise the member's name.
  from: string;
  to: string;
  // The status in words (DESIGN.md "PaymentCard"), never color alone.
  status: string;
  // The one thing the viewer may do now, if anything.
  action: PaymentAction | null;
};

// How a payment reads to one viewer, wherever it is shown: a PaymentCard in a
// settle-up or a row in the group's payment list (#14).
export function describePayment(
  payment: Payment,
  currentUserId: string,
  // User id to name, for the members the viewer can see.
  names: Record<string, string>,
): PaymentDescription {
  const name = (userId: string) =>
    userId === currentUserId ? "You" : (names[userId] ?? "a former member");
  const from = name(payment.fromUserId);
  const to = name(payment.toUserId);
  const isSender = payment.fromUserId === currentUserId;
  const isRecipient = payment.toUserId === currentUserId;

  if (payment.status === "suggested") {
    return {
      from,
      to,
      status: isSender
        ? "Suggested · pay however you like"
        : `Suggested · waiting for ${from} to pay`,
      action: isSender ? "paid" : null,
    };
  }
  if (payment.status === "paid") {
    return {
      from,
      to,
      status: isRecipient
        ? "Marked paid · waiting for you to confirm"
        : `Marked paid · waiting for ${to} to confirm`,
      action: isRecipient ? "confirmed" : null,
    };
  }
  return { from, to, status: "Confirmed · done", action: null };
}

export type DeclineDescription = {
  // What the ConfirmDialog asks before the decline is sent.
  question: string;
  // The notice once it is declined.
  done: string;
};

// What the recipient of a paid payment is asked before saying the money never
// arrived, and told after (#108). A settle-up payment goes back to suggested;
// a direct payment is removed. `from` is the sender's name.
export function describeDecline(
  payment: Payment,
  from: string,
): DeclineDescription {
  const amount = formatCents(payment.amountCents);
  if (payment.settlementId === null) {
    return {
      question: `Didn't get ${amount} from ${from}? The payment is removed, and ${from} can record it again once it's sent.`,
      done: `Declined. The ${amount} from ${from} is removed.`,
    };
  }
  return {
    question: `Didn't get ${amount} from ${from}? It goes back to suggested, so ${from} can mark it paid again once it's sent.`,
    done: `Declined. ${from} can mark it paid again once it's sent.`,
  };
}
