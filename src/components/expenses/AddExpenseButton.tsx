"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotice } from "@/components/ui/NoticeProvider";
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

// The button that opens the New entry form. It also says what was added: the
// new cost shows up in the page's list after the refresh, but a screen reader
// only hears about it through the notice.
export function AddExpenseButton({
  groups,
  currentUserId,
  defaultGroupId,
}: AddExpenseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Shown in NoticeLine, above the list on the group page.
  const { show, clear } = useNotice();

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
