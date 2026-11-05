import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Payment } from "@/lib/db/settlements";
import { formatCents } from "@/lib/domain/money";

// What the viewer can do to a payment: the sender marks it paid, the
// recipient confirms it.
export type PaymentAction = "paid" | "confirmed";

type PaymentCardProps = {
  payment: Payment;
  // User id to name, for the members the viewer can see.
  names: Record<string, string>;
  currentUserId: string;
  onAct: (payment: Payment, action: PaymentAction) => void;
  // While an action is being sent, so it isn't sent twice.
  busy?: boolean;
};

// One suggested payment (DESIGN.md "PaymentCard"): "You → Sam" with the
// amount, its status in words, and the one button the viewer may press. A
// card the viewer has to act on gets the owe offset shadow.
export function PaymentCard({
  payment,
  names,
  currentUserId,
  onAct,
  busy = false,
}: PaymentCardProps) {
  const name = (userId: string) =>
    userId === currentUserId ? "You" : (names[userId] ?? "a former member");
  const from = name(payment.fromUserId);
  const to = name(payment.toUserId);
  const isSender = payment.fromUserId === currentUserId;
  const isRecipient = payment.toUserId === currentUserId;

  let status: string;
  let action: PaymentAction | null = null;
  if (payment.status === "suggested") {
    status = isSender
      ? "Suggested · pay however you like"
      : `Suggested · waiting for ${from} to pay`;
    action = isSender ? "paid" : null;
  } else if (payment.status === "paid") {
    status = isRecipient
      ? "Marked paid · waiting for you to confirm"
      : `Marked paid · waiting for ${to} to confirm`;
    action = isRecipient ? "confirmed" : null;
  } else {
    status = "Confirmed · done";
  }
  const needsYou = action !== null;

  return (
    <li
      data-needs-you={needsYou ? "true" : "false"}
      className={`flex flex-col gap-3 rounded-2xl border-4 border-ink bg-surface p-4 ${
        needsYou ? "shadow-[6px_6px_0_0_var(--color-owe)]" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">
            {from} → {to}
          </h3>
          <p className="text-sm font-semibold text-muted">{status}</p>
        </div>
        <p className="text-2xl font-bold">{formatCents(payment.amountCents)}</p>
      </div>
      {action === "paid" ? (
        <div className="self-end">
          <PrimaryButton disabled={busy} onClick={() => onAct(payment, "paid")}>
            I paid this<span aria-hidden="true"> 💸</span>
          </PrimaryButton>
        </div>
      ) : null}
      {action === "confirmed" ? (
        <div className="self-end">
          <PrimaryButton
            disabled={busy}
            onClick={() => onAct(payment, "confirmed")}
          >
            I got it<span aria-hidden="true"> ✅</span>
          </PrimaryButton>
        </div>
      ) : null}
    </li>
  );
}
