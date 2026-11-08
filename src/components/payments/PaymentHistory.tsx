"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDay } from "@/components/groups/format-day";
import { useNotice } from "@/components/ui/NoticeProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Payment } from "@/lib/db/settlements";
import { formatCents } from "@/lib/domain/money";
import { postJson } from "@/lib/http/api-client";
import { describePayment } from "./payment-status";

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
// of a paid one confirms it here with I got it. Balances come from the server
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

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Payments</h2>
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
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold">
                    {formatCents(payment.amountCents)}
                  </p>
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
    </section>
  );
}
