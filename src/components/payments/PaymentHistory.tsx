"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDay } from "@/components/groups/format-day";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useNotice } from "@/components/ui/NoticeProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Payment } from "@/lib/db/settlements";
import { formatCents } from "@/lib/domain/money";
import { postJson } from "@/lib/http/api-client";
import { describeDecline, describePayment } from "./payment-status";

type PaymentHistoryProps = {
  groupId: string;
  // Paid and confirmed payments, last paid first, from the server.
  payments: Payment[];
  // User id to name, for the members the viewer can see.
  names: Record<string, string>;
  currentUserId: string;
  // A group the user left, or an archived one: nothing can be confirmed.
  readOnly: boolean;
};

// The group's payment history (#14, user flow 6): every payment someone has
// sent, direct or from a settle-up, with its status in words. The recipient
// of a paid one confirms it here with I got it, or says it never arrived with
// I didn't get it (#108). Balances come from the server
// again after the refresh, never from this list (AGENTS.md Section 8).
export function PaymentHistory({
  groupId,
  payments,
  names,
  currentUserId,
  readOnly,
}: PaymentHistoryProps) {
  const router = useRouter();
  const { show, clear } = useNotice();
  const [busyId, setBusyId] = useState<string | null>(null);
  // The paid payment the recipient is asked about before declining (#108).
  const [declining, setDeclining] = useState<Payment | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set when a decline is answered; the render that closes the dialog reads it.
  const focusHeadingNext = useRef(false);
  // ConfirmDialog hands focus back to I didn't get it when it closes, and the
  // refresh then takes that button away. This effect runs after the dialog's,
  // since a parent's effects run after its children's, so the heading wins.
  useEffect(() => {
    if (focusHeadingNext.current) {
      focusHeadingNext.current = false;
      headingRef.current?.focus();
    }
  });
  const nameOf = (userId: string) => names[userId] ?? "a former member";

  // Disabling the button while the request is on its way drops focus to body
  // in a browser, and the refresh takes the button away, so the row gets
  // focus once the answer is in.
  async function confirm(
    payment: Payment,
    from: string,
    row: HTMLLIElement | null,
  ) {
    setBusyId(payment.id);
    clear();
    const result = await postJson<{ payment: Payment; closed: boolean }>(
      `/api/groups/${groupId}/payments/${payment.id}/confirm`,
      {},
    );
    setBusyId(null);
    row?.focus();
    if (!result.ok) {
      show(result.error.message, "problem");
    } else if (result.data.closed) {
      show("Confirmed. That was the last one: the period is closed.", "done");
    } else {
      show(
        `Confirmed ${formatCents(payment.amountCents)} from ${from}. Balances are updated.`,
        "done",
      );
    }
    router.refresh();
  }

  // The row's buttons go away with the refresh, and a declined direct
  // payment's whole row with them, so focus moves to the heading.
  async function decline(payment: Payment) {
    setBusyId(payment.id);
    clear();
    const result = await postJson<{ payment: Payment } | undefined>(
      `/api/groups/${groupId}/payments/${payment.id}/decline`,
      {},
    );
    setBusyId(null);
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

  return (
    <section className="flex flex-col gap-3">
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
        Payments
      </h2>
      {payments.length === 0 ? (
        <p className="text-muted">No payments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {payments.map((payment) => {
            const { from, to, status, action } = describePayment(
              payment,
              currentUserId,
              names,
            );
            const canConfirm = action === "confirmed" && !readOnly;
            return (
              <li
                key={payment.id}
                tabIndex={-1}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink bg-surface p-3 ${
                  canConfirm ? "shadow-[4px_4px_0_0_var(--color-owe)]" : ""
                }`}
              >
                <div className="flex flex-col">
                  <p className="font-bold">{`${from} → ${to}`}</p>
                  <p className="text-sm font-semibold text-muted">{status}</p>
                  {payment.paidAt ? (
                    <p className="text-sm text-muted">
                      Paid {formatDay(payment.paidAt)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-lg font-bold">
                    {formatCents(payment.amountCents)}
                  </p>
                  {canConfirm ? (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => setDeclining(payment)}
                      className="rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:bg-disabled disabled:text-ink"
                    >
                      {"I didn't get it"}
                    </button>
                  ) : null}
                  {canConfirm ? (
                    <PrimaryButton
                      disabled={busyId !== null}
                      onClick={(event) =>
                        confirm(
                          payment,
                          from,
                          event.currentTarget.closest("li"),
                        )
                      }
                    >
                      I got it<span aria-hidden="true"> ✅</span>
                    </PrimaryButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={declining !== null}
        message={
          declining
            ? describeDecline(declining, nameOf(declining.fromUserId)).question
            : ""
        }
        confirmLabel="Decline payment"
        onConfirm={() => {
          if (declining) {
            void decline(declining);
          }
        }}
        onCancel={() => setDeclining(null)}
        busy={busyId !== null}
      />
    </section>
  );
}
