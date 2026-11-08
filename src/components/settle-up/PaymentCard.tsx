import {
  describePayment,
  type PaymentAction,
} from "@/components/payments/payment-status";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Payment } from "@/lib/db/settlements";
import { formatCents } from "@/lib/domain/money";

export type { PaymentAction };

type PaymentCardProps = {
  payment: Payment;
  // User id to name, for the members the viewer can see.
  names: Record<string, string>;
  currentUserId: string;
  onAct: (payment: Payment, action: PaymentAction) => void;
  // While an action is being sent, so it isn't sent twice.
  busy?: boolean;
  // False for a read-only viewer, who gets the card without its button.
  canAct?: boolean;
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
  canAct = true,
}: PaymentCardProps) {
  const described = describePayment(payment, currentUserId, names);
  const { from, to, status } = described;
  const action = canAct ? described.action : null;
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
