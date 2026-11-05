"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NOTICE_TONES, useNotice } from "@/components/ui/NoticeProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { EntryForm, type EntryGroup } from "./EntryForm";
import { expenseNotice, planNotice } from "./entry-notices";

type AddExpenseButtonProps = {
  // Only the groups the user can add to: not ones they left or archived ones.
  groups: EntryGroup[];
  currentUserId: string;
  // The group whose page the button is on.
  defaultGroupId?: string;
};

// The button that opens the New entry form. Nothing on the page lists expenses
// yet, so it also says what was added.
// TODO(#15): drop the notice once the expense list shows it.
export function AddExpenseButton({
  groups,
  currentUserId,
  defaultGroupId,
}: AddExpenseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { notice, show, clear } = useNotice("costs");

  return (
    <div className="flex flex-col gap-2">
      <div>
        <PrimaryButton
          onClick={() => {
            clear();
            setOpen(true);
          }}
        >
          <span aria-hidden="true">💸 </span>Log a cost
        </PrimaryButton>
      </div>
      {/* The region stays in the page, so a notice is announced when it
          appears instead of being created along with its text. */}
      <p
        role="status"
        className={`font-semibold ${notice ? NOTICE_TONES[notice.tone] : ""}`}
      >
        {notice?.text}
      </p>
      <EntryForm
        groups={groups}
        currentUserId={currentUserId}
        defaultGroupId={defaultGroupId}
        open={open}
        onClose={() => setOpen(false)}
        onAdded={(expense, group) => {
          show(expenseNotice(expense, group), "done");
          router.refresh();
        }}
        // The form can switch to Plan it, so the list on the page needs the
        // refresh too.
        onPlanned={(item, group) => {
          show(planNotice(item, group), "done");
          router.refresh();
        }}
      />
    </div>
  );
}
