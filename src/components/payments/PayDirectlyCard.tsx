"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotice } from "@/components/ui/NoticeProvider";
import type { Member } from "@/lib/db/group-members";
import type { Payment } from "@/lib/db/settlements";
import { formatCents } from "@/lib/domain/money";
import { DirectPaymentForm } from "./DirectPaymentForm";

type PayDirectlyCardProps = {
  groupId: string;
  // The group's current members, the viewer among them.
  members: Member[];
  currentUserId: string;
};

// "Pay one person directly" (DESIGN.md "PayDirectlyCard", user flow 6): a
// dashed card whose Pay button opens the payment form. The payment then waits
// in the group's payment list until the recipient confirms it.
export function PayDirectlyCard({
  groupId,
  members,
  currentUserId,
}: PayDirectlyCardProps) {
  const router = useRouter();
  const { show, clear } = useNotice();
  const [open, setOpen] = useState(false);
  const names = Object.fromEntries(
    members.map((member) => [member.userId, member.name]),
  );
  const hasSomeoneToPay = members.some(
    (member) => member.userId !== currentUserId,
  );

  function recorded(payment: Payment) {
    const to = names[payment.toUserId] ?? "them";
    show(
      `Recorded ${formatCents(payment.amountCents)} to ${to}. It counts once ${to} confirms it.`,
      "done",
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-ink p-4">
      <div>
        <p className="font-bold">
          <span aria-hidden="true">🤝 </span>Pay one person directly
        </p>
        <p className="text-sm text-muted">
          {hasSomeoneToPay
            ? "Between settle-ups, one payment at a time."
            : "There's nobody else in this group to pay yet."}
        </p>
      </div>
      {hasSomeoneToPay ? (
        <>
          <button
            type="button"
            onClick={() => {
              clear();
              setOpen(true);
            }}
            className="rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold"
          >
            Pay<span aria-hidden="true"> →</span>
          </button>
          <DirectPaymentForm
            groupId={groupId}
            members={members}
            currentUserId={currentUserId}
            open={open}
            onClose={() => setOpen(false)}
            onRecorded={recorded}
          />
        </>
      ) : null}
    </div>
  );
}
