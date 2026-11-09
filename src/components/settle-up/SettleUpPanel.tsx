"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useNotice } from "@/components/ui/NoticeProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Payment } from "@/lib/db/settlements";
import { describeDecline } from "@/components/payments/payment-status";
import { postJson } from "@/lib/http/api-client";
import type { SettleUp } from "@/lib/services/settlement-service";
import { PaymentCard, type PaymentAction } from "./PaymentCard";

type SettleUpPanelProps = {
  groupId: string;
  // The open settle-up, or null when none is open.
  settleUp: SettleUp | null;
  // User id to name, for the members the viewer can see.
  names: Record<string, string>;
  currentUserId: string;
  // How many members the group has, for "2 payments, not 6".
  memberCount: number;
  // A group the user left, or an archived one: nothing can be started,
  // paid, confirmed or cancelled.
  readOnly: boolean;
};

function paymentsLabel(count: number): string {
  return count === 1 ? "1 payment" : `${count} payments`;
}

// "Fewest payments" (DESIGN.md "PaymentCard", user flow 5): start a settle-up,
// then each suggested payment as a card the sender marks paid and the
// recipient confirms. The page is refreshed after every action, so the cards
// and the standings come from the server again.
export function SettleUpPanel({
  groupId,
  settleUp,
  names,
  currentUserId,
  memberCount,
  readOnly,
}: SettleUpPanelProps) {
  const router = useRouter();
  const { show, clear } = useNotice();
  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // The paid payment the recipient is asked about before declining (#108).
  const [declining, setDeclining] = useState<Payment | null>(null);
  const nameOf = (userId: string) => names[userId] ?? "a former member";
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set when a decline is answered; the render that closes the dialog reads it.
  const focusHeadingNext = useRef(false);
  // ConfirmDialog hands focus back to I didn't get it when it closes, and the
  // refresh then takes that button away. This effect runs after the dialog's,
  // since a parent's effects run after its children's, so the heading wins.
  // It only has work to do when the dialog closes.
  useEffect(() => {
    if (declining === null && focusHeadingNext.current) {
      focusHeadingNext.current = false;
      headingRef.current?.focus();
    }
  }, [declining]);

  async function start() {
    setBusy(true);
    clear();
    const result = await postJson<{ settleUp: SettleUp }>(
      `/api/groups/${groupId}/settlements`,
      {},
    );
    setBusy(false);
    if (result.ok) {
      const started = result.data.settleUp;
      show(
        started.status === "closed"
          ? "Everyone was settled up, so the period closed."
          : `Settle-up started: ${paymentsLabel(started.payments.length)} to make.`,
        "done",
      );
    } else {
      show(result.error.message, "problem");
    }
    // Either way the page may be out of date: someone else may have started.
    router.refresh();
  }

  async function act(payment: Payment, action: PaymentAction) {
    setBusy(true);
    clear();
    const result = await postJson<{ payment: Payment; closed?: boolean }>(
      `/api/groups/${groupId}/payments/${payment.id}/${action === "paid" ? "paid" : "confirm"}`,
      {},
    );
    setBusy(false);
    if (!result.ok) {
      show(result.error.message, "problem");
    } else if (action === "paid") {
      show(
        `Marked paid. ${nameOf(payment.toUserId)} can confirm it now.`,
        "done",
      );
    } else if (result.data.closed) {
      show("Confirmed. That was the last one: the period is closed.", "done");
    } else {
      show(
        "Confirmed. The period closes when every payment is confirmed.",
        "done",
      );
    }
    router.refresh();
  }

  // The recipient says the money never arrived (#108): the payment goes back
  // to suggested, so the payer can mark it again.
  async function decline(payment: Payment) {
    setBusy(true);
    clear();
    const result = await postJson<{ payment: Payment }>(
      `/api/groups/${groupId}/payments/${payment.id}/decline`,
      {},
    );
    setBusy(false);
    // On a failure the buttons are still there, so the dialog hands focus
    // back to I didn't get it instead.
    focusHeadingNext.current = result.ok;
    setDeclining(null);
    if (result.ok) {
      show(describeDecline(payment, nameOf(payment.fromUserId)).done, "done");
    } else {
      show(result.error.message, "problem");
    }
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    clear();
    const result = await postJson(
      `/api/groups/${groupId}/settlements/current/cancel`,
      {},
    );
    setBusy(false);
    setConfirmingCancel(false);
    if (result.ok) {
      show("Settle-up cancelled. The costs stay unsettled.", "done");
    } else {
      show(result.error.message, "problem");
    }
    router.refresh();
  }

  const payments = settleUp?.payments ?? [];
  const canCancel =
    settleUp !== null &&
    !readOnly &&
    payments.every((payment) => payment.status === "suggested");

  return (
    <section aria-labelledby="payments-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="payments-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold"
        >
          <span aria-hidden="true">🧮 </span>Fewest payments
        </h2>
        {settleUp ? (
          <p className="font-semibold text-muted">
            {paymentsLabel(payments.length)}, not{" "}
            {memberCount * (memberCount - 1)}
          </p>
        ) : null}
      </div>
      {settleUp === null ? (
        <>
          <p className="text-muted">No settle-up is open.</p>
          {readOnly ? null : (
            <div>
              <PrimaryButton disabled={busy} onClick={start}>
                <span aria-hidden="true">💸 </span>Start settle-up
              </PrimaryButton>
            </div>
          )}
        </>
      ) : (
        <>
          {payments.length === 0 ? (
            <p className="text-muted">Nothing to pay.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {payments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  names={names}
                  currentUserId={currentUserId}
                  onAct={act}
                  onDecline={setDeclining}
                  busy={busy}
                  canAct={!readOnly}
                />
              ))}
            </ul>
          )}
          {canCancel ? (
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingCancel(true)}
                className="rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                Cancel settle-up
              </button>
            </div>
          ) : null}
          <ConfirmDialog
            open={confirmingCancel}
            message="Cancel this settle-up? The suggested payments are removed and the costs stay unsettled."
            confirmLabel="Yes, cancel it"
            onConfirm={cancel}
            onCancel={() => setConfirmingCancel(false)}
            busy={busy}
          />
          <ConfirmDialog
            open={declining !== null}
            message={
              declining
                ? describeDecline(declining, nameOf(declining.fromUserId))
                    .question
                : ""
            }
            confirmLabel="Decline payment"
            onConfirm={() => {
              if (declining) {
                void decline(declining);
              }
            }}
            onCancel={() => setDeclining(null)}
            busy={busy}
          />
        </>
      )}
    </section>
  );
}
