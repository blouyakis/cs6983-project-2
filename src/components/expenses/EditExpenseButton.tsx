"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import { formatCents } from "@/lib/domain/money";
import { EditExpenseForm } from "./EditExpenseForm";

type EditExpenseButtonProps = {
  expense: Expense;
  groupName: string;
  members: Member[];
  currentUserId: string;
};

// The pencil button on an expense the user can edit (DESIGN.md
// "ExpenseTable"). It opens EditExpenseForm, then refreshes the page so the
// list and balances show the change, and says what happened.
export function EditExpenseButton({
  expense,
  groupName,
  members,
  currentUserId,
}: EditExpenseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string>();

  return (
    <>
      <button
        type="button"
        aria-label={`Edit ${expense.description}`}
        onClick={() => {
          setNotice(undefined);
          setOpen(true);
        }}
        className="rounded-lg border-2 border-ink bg-surface px-3 py-1 text-lg leading-none"
      >
        <span aria-hidden="true">✏️</span>
      </button>
      {/* The region stays in the page, so a notice is announced when it
          appears instead of being created along with its text. */}
      <span role="status" className="sr-only">
        {notice}
      </span>
      <EditExpenseForm
        expense={expense}
        groupName={groupName}
        members={members}
        currentUserId={currentUserId}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(saved) => {
          setNotice(`Saved ${saved.description}.`);
          router.refresh();
        }}
        onDeleted={() => {
          setNotice(
            `Deleted ${expense.description} (${formatCents(expense.amountCents)}).`,
          );
          router.refresh();
        }}
      />
    </>
  );
}
