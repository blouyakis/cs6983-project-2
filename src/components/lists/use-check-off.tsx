"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useNotice, type Notice } from "@/components/ui/NoticeProvider";
import type { Member } from "@/lib/db/group-members";
import type { ListItem } from "@/lib/db/list-items";
import { splitLeadingEmoji } from "@/lib/domain/leading-emoji";
import { formatCents } from "@/lib/domain/money";
import { postJson } from "@/lib/http/api-client";
import { CheckOffForm } from "./CheckOffForm";

type CheckOffOptions = {
  groupId: string;
  isPersonal: boolean;
  // The group's current members, for the split. Empty in the personal space.
  members: Member[];
  currentUserId: string;
};

// A done item to uncheck, with what it cost, for the ConfirmDialog's words.
type Unchecking = { item: ListItem; costCents: number | null };

// Checking a list item off and unchecking it (user flow 2, #12; DESIGN.md
// "ListItemRow"), shared by a group's list and My list on the overview. An
// open item opens CheckOffForm. A done one opens a ConfirmDialog first, since
// unchecking deletes its expense. Either way a notice says what happened and
// the page is refreshed, so the list, its totals and the balances come from
// the server again. Render `elements` once, next to the list.
export function useCheckOff({
  groupId,
  isPersonal,
  members,
  currentUserId,
}: CheckOffOptions): {
  start: (item: ListItem, costCents: number | null) => void;
  elements: ReactNode;
} {
  const router = useRouter();
  const { show, clear } = useNotice();
  // The item stays after the form closes, so FormSheet sees open turn false
  // and returns focus to the checkbox. Each opening gets a new key, so the
  // form starts empty.
  const [checking, setChecking] = useState<ListItem>();
  const [formOpen, setFormOpen] = useState(false);
  const [formCount, setFormCount] = useState(0);

  const [unchecking, setUnchecking] = useState<Unchecking>();
  // The ref turns away a second confirm before React has re-rendered the
  // dialog as busy.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  // What the uncheck did, held until the dialog has closed: the page behind a
  // modal is inert, and a screen reader may skip a change there.
  const noticeRef = useRef<Notice>(undefined);
  useEffect(() => {
    if (unchecking !== undefined) {
      return;
    }
    const notice = noticeRef.current;
    if (notice !== undefined) {
      noticeRef.current = undefined;
      show(notice.text, notice.tone);
    }
  }, [unchecking, show]);

  function start(item: ListItem, costCents: number | null) {
    clear();
    if (item.status === "open") {
      setChecking(item);
      setFormCount((count) => count + 1);
      setFormOpen(true);
    } else {
      setUnchecking({ item, costCents });
    }
  }

  // The dialog stays open until the answer comes back, so the notice and the
  // list agree with what the user saw.
  async function confirmUncheck() {
    if (unchecking === undefined || busyRef.current) {
      return;
    }
    const { item, costCents } = unchecking;
    const { text } = splitLeadingEmoji(item.title);
    busyRef.current = true;
    setBusy(true);
    const result = await postJson(
      `/api/groups/${groupId}/list-items/${item.id}/reopen`,
    );
    busyRef.current = false;
    setBusy(false);
    noticeRef.current = result.ok
      ? {
          text:
            costCents === null
              ? `Unchecked ${text}.`
              : `Unchecked ${text} and deleted its ${formatCents(costCents)} expense.`,
          tone: "done",
        }
      : { text: result.error.message, tone: "problem" };
    // On a refusal the list is out of date too: someone settled the expense,
    // or another tab already unchecked it.
    router.refresh();
    setUnchecking(undefined);
  }

  // Once the uncheck is sent, Cancel and Escape would only hide that it is
  // still going through, so they wait for the answer.
  function cancelUncheck() {
    if (!busyRef.current) {
      setUnchecking(undefined);
    }
  }

  function uncheckMessage({ item, costCents }: Unchecking): string {
    const { text } = splitLeadingEmoji(item.title);
    return costCents === null
      ? `Uncheck ${text}? It goes back on the list.`
      : `Uncheck ${text}? This deletes its ${formatCents(costCents)} expense.`;
  }

  const elements = (
    <>
      {checking ? (
        <CheckOffForm
          key={formCount}
          item={checking}
          open={formOpen}
          groupId={groupId}
          isPersonal={isPersonal}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setFormOpen(false)}
          onCheckedOff={(item, costCents) => {
            const { text } = splitLeadingEmoji(item.title);
            show(
              costCents === 0
                ? `Checked off ${text}.`
                : `Checked off ${text} for ${formatCents(costCents)}.`,
              "done",
            );
            router.refresh();
          }}
          onRefused={() => router.refresh()}
        />
      ) : null}
      <ConfirmDialog
        open={unchecking !== undefined}
        message={unchecking === undefined ? "" : uncheckMessage(unchecking)}
        confirmLabel={
          unchecking?.costCents == null ? "Uncheck" : "Uncheck and delete"
        }
        onConfirm={confirmUncheck}
        onCancel={cancelUncheck}
        busy={busy}
      />
    </>
  );

  return { start, elements };
}
