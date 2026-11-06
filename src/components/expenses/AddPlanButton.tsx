"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotice } from "@/components/ui/NoticeProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { EntryForm, type EntryGroup } from "./EntryForm";
import { expenseNotice, planNotice } from "./entry-notices";

type AddPlanButtonProps = {
  // Only the groups the user can add to: not ones they left or archived ones.
  groups: EntryGroup[];
  currentUserId: string;
  // The group the button belongs to, such as the GroupCard it sits on.
  defaultGroupId?: string;
  label: string;
  // A fuller name when the label repeats on the page, as on each GroupCard:
  // "Add plan here, 🏠 Dorm 4B". It starts with the label, so speech input
  // still finds it by what it shows.
  accessibleName?: string;
  primary?: boolean;
};

const SECONDARY =
  "rounded-lg border-2 border-ink bg-surface px-4 py-2 font-semibold shadow-[3px_3px_0_0_var(--color-ink)]";

// Opens the New entry form on Plan it (DESIGN.md "EntryForm"). The form can
// still switch to Already spent, so both kinds of entry are handled.
export function AddPlanButton({
  groups,
  currentUserId,
  defaultGroupId,
  label,
  accessibleName,
  primary = false,
}: AddPlanButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { show, clear } = useNotice();
  const openForm = () => {
    clear();
    setOpen(true);
  };
  const content = (
    <>
      <span aria-hidden="true">✏️ </span>
      {label}
    </>
  );

  return (
    <>
      {primary ? (
        <PrimaryButton aria-label={accessibleName} onClick={openForm}>
          {content}
        </PrimaryButton>
      ) : (
        <button
          type="button"
          aria-label={accessibleName}
          onClick={openForm}
          className={SECONDARY}
        >
          {content}
        </button>
      )}
      <EntryForm
        groups={groups}
        currentUserId={currentUserId}
        defaultGroupId={defaultGroupId}
        initialMode="plan"
        open={open}
        onClose={() => setOpen(false)}
        onAdded={(expense, group) => {
          show(expenseNotice(expense, group), "done");
          router.refresh();
        }}
        onPlanned={(item, group) => {
          show(planNotice(item, group), "done");
          router.refresh();
        }}
      />
    </>
  );
}
