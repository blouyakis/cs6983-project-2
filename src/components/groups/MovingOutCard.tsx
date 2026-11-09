"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useNotice } from "@/components/ui/NoticeProvider";
import { formatCents } from "@/lib/domain/money";
import { postJson } from "@/lib/http/api-client";

type MovingOutCardProps = {
  groupId: string;
  groupName: string;
  // The user's balance from the server: positive when the group owes them.
  balanceCents: number;
  // A payment to or from the user is still suggested or paid.
  hasWaitingPayment: boolean;
  // The user is the group's only current member, so leaving archives it.
  isLastMember: boolean;
};

// Why Leave group is off, in words (AGENTS.md Section 8: never color alone),
// or null when the user can leave. The server checks the same again.
function blockedReason(
  balanceCents: number,
  hasWaitingPayment: boolean,
): string | null {
  if (balanceCents < 0) {
    return `You owe ${formatCents(-balanceCents)} in this group.`;
  }
  if (balanceCents > 0) {
    return `You are owed ${formatCents(balanceCents)} in this group.`;
  }
  if (hasWaitingPayment) {
    return "A payment to or from you is still waiting to be paid or confirmed.";
  }
  return null;
}

// "Moving out?" (DESIGN.md "MovingOutCard", user flow 8, #22): Leave group
// stays disabled until the user's balance is zero and no payment of theirs
// is waiting, with Settle my $X first linking to the settle-up page. Leaving
// asks first, then goes to the Groups page, where the group shows as one
// they left.
export function MovingOutCard({
  groupId,
  groupName,
  balanceCents,
  hasWaitingPayment,
  isLastMember,
}: MovingOutCardProps) {
  const router = useRouter();
  const { show, clear } = useNotice();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  const reason = blockedReason(balanceCents, hasWaitingPayment);

  async function leave() {
    setBusy(true);
    clear();
    const result = await postJson(`/api/groups/${groupId}/leave`);
    setBusy(false);
    setConfirming(false);
    if (result.ok) {
      router.push("/groups");
    } else {
      show(result.error.message, "problem");
    }
    // The sidebar and the page read the groups again, whichever way it went.
    router.refresh();
  }

  const message =
    `Leave ${groupName}? You'll keep read-only access to its history up to today.` +
    (isLastMember ? " As its last member, you'll archive the group." : "");

  return (
    <section
      aria-labelledby={`${reasonId}-heading`}
      className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-owe bg-surface p-4"
    >
      <h2 id={`${reasonId}-heading`} className="text-lg font-bold">
        <span aria-hidden="true">🚪 </span>Moving out?
      </h2>
      <p>
        You can leave once your balance is $0.00, through a group settle-up or a
        direct payment.
      </p>
      {reason ? (
        <p id={reasonId} className="font-semibold">
          {reason}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        {balanceCents !== 0 ? (
          <Link
            href={`/groups/${groupId}/settle-up`}
            className="rounded-lg border-2 border-ink bg-action px-4 py-2 font-semibold text-white shadow-[3px_3px_0_0_var(--color-ink)]"
          >
            Settle my {formatCents(Math.abs(balanceCents))} first
            <span aria-hidden="true"> 💸</span>
          </Link>
        ) : null}
        <button
          type="button"
          disabled={reason !== null}
          aria-describedby={reason ? reasonId : undefined}
          onClick={() => {
            clear();
            setConfirming(true);
          }}
          className="rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold disabled:border-muted disabled:bg-disabled disabled:text-muted"
        >
          Leave group<span aria-hidden="true"> 🚪</span>
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        message={message}
        confirmLabel="Leave group"
        onConfirm={leave}
        onCancel={() => setConfirming(false)}
        busy={busy}
      />
    </section>
  );
}
