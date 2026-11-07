"use client";

import { FormSheet } from "@/components/ui/FormSheet";
import { TextField } from "@/components/ui/TextField";
import { SplitEditor } from "@/components/expenses/SplitEditor";
import type { Member } from "@/lib/db/group-members";
import type { ListItem } from "@/lib/db/list-items";
import { formatCents, parseDollars } from "@/lib/domain/money";
import {
  initialSplitState,
  resolveSplit,
  type SplitState,
} from "@/components/expenses/split-state";
import { useState } from "react";

type CheckOffFormProps = {
  open: boolean;
  item: ListItem | null;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  onSubmit: (
    itemId: string,
    amountCents: number,
    shares: Record<string, number>,
  ) => Promise<void>;
  submitting?: boolean;
  error?: string;
};

// Form for checking off a list item with a cost and split (#12)
export function CheckOffForm({
  open,
  item,
  members,
  currentUserId,
  onClose,
  onSubmit,
  submitting = false,
  error,
}: CheckOffFormProps) {
  const [amountText, setAmountText] = useState("");
  const [splitState, setSplitState] = useState<SplitState>(() =>
    initialSplitState(members),
  );

  const amountCents = amountText ? parseDollars(amountText) : null;

  async function handleSubmit() {
    if (!item || amountCents === null) {
      return;
    }

    const resolved = resolveSplit(
      splitState,
      members,
      currentUserId,
      amountCents,
    );
    if ("fieldErrors" in resolved) {
      // Errors are displayed by the error prop
      return;
    }

    const shares: Record<string, number> = {};
    for (const share of resolved.shares) {
      shares[share.userId] = share.shareCents;
    }

    try {
      await onSubmit(item.id, amountCents, shares);
      setAmountText("");
      setSplitState(initialSplitState(members));
    } catch {
      // Error is displayed via the error prop
    }
  }

  return (
    <FormSheet
      open={open && item !== null}
      title={item ? `Check off: ${item.title}` : "Check off"}
      primaryLabel="Done"
      onSubmit={handleSubmit}
      onClose={onClose}
      submitting={submitting}
      error={error}
    >
      <TextField
        label="Cost"
        name="amountCents"
        type="text"
        inputMode="decimal"
        value={amountText}
        onChange={(e) => setAmountText(e.currentTarget.value)}
        placeholder={`e.g. ${formatCents(1499)}`}
        error={amountText && amountCents === null ? "Enter a valid amount" : ""}
      />

      <SplitEditor
        members={members}
        payerId={currentUserId}
        amountCents={amountCents}
        state={splitState}
        onChange={setSplitState}
      />
    </FormSheet>
  );
}
