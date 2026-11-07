"use client";

import { useState } from "react";
import { SplitEditor } from "@/components/expenses/SplitEditor";
import {
  initialSplitState,
  resolveSplit,
  type SplitFields,
  type SplitState,
} from "@/components/expenses/split-state";
import { FormSheet } from "@/components/ui/FormSheet";
import { TextField } from "@/components/ui/TextField";
import type { Member } from "@/lib/db/group-members";
import type { ListItem } from "@/lib/db/list-items";
import { splitLeadingEmoji } from "@/lib/domain/leading-emoji";
import { parseDollars } from "@/lib/domain/money";
import { postJson } from "@/lib/http/api-client";
import { ValidationError } from "@/lib/http/errors";
import {
  completeItemSchema,
  type CompleteItemInput,
} from "@/lib/validation/list-item";
import { parseInput } from "@/lib/validation/parse";

type CheckOffFormProps = {
  // An open item.
  item: ListItem;
  open: boolean;
  groupId: string;
  isPersonal: boolean;
  // The group's current members, who can share the cost. Not used in the
  // personal space, where the owner is the only sharer (#23).
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  // The item is done; costCents is what was entered, 0 for no cost.
  onCheckedOff: (item: ListItem, costCents: number) => void;
  // The server refused the check-off as a whole, such as a 409 because
  // someone checked it off first, or a 404 because someone deleted it. The
  // list on the page is out of date then. Not called for a field error.
  onRefused: () => void;
};

const ENTER_COST =
  "Enter the cost in dollars and cents, such as 12.34, or leave it blank if it cost nothing.";

// Checks an open item off (user flow 2, #12): the actual cost and who shares
// it, with SplitEditor, as when adding an expense. The member checking it off
// pays, so there is no payer field. A blank cost checks it off with no
// expense. Render it with a key per opening, so it starts empty each time.
export function CheckOffForm({
  item,
  open,
  groupId,
  isPersonal,
  members,
  currentUserId,
  onClose,
  onCheckedOff,
  onRefused,
}: CheckOffFormProps) {
  const [costText, setCostText] = useState("");
  const [split, setSplit] = useState<SplitState>(() =>
    initialSplitState(members),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const blank = costText.trim() === "";
  const amountCents = blank ? 0 : parseDollars(costText);
  const { text } = splitLeadingEmoji(item.title);

  // Changing a field clears the error that was shown next to it.
  function clearErrors(...fields: string[]) {
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => !fields.includes(field)),
      ),
    );
  }

  async function handleSubmit() {
    if (amountCents === null) {
      setErrors({ amountCents: ENTER_COST });
      setFormError(undefined);
      return;
    }
    // Nothing is split when it cost nothing, or in the personal space.
    const only: SplitFields = { mode: "even", sharedBy: [currentUserId] };
    const resolved =
      isPersonal || amountCents === 0
        ? null
        : resolveSplit(split, members, currentUserId, amountCents);
    if (resolved && "fieldErrors" in resolved) {
      setErrors(resolved.fieldErrors);
      setFormError(undefined);
      return;
    }

    let body: CompleteItemInput;
    try {
      body = parseInput(completeItemSchema, {
        amountCents,
        ...(resolved ? resolved.fields : only),
      });
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
      setErrors(error.fields ?? {});
      setFormError(undefined);
      return;
    }

    setSubmitting(true);
    const result = await postJson<{ item: ListItem }>(
      `/api/groups/${groupId}/list-items/${item.id}/complete`,
      body,
    );
    setSubmitting(false);
    if (result.ok) {
      onCheckedOff(item, amountCents);
      onClose();
      return;
    }
    setErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? undefined : result.error.message);
    if (!result.error.fields) {
      onRefused();
    }
  }

  return (
    <FormSheet
      open={open}
      title={`Check off ${text}`}
      primaryLabel="Check off"
      onSubmit={handleSubmit}
      onClose={onClose}
      submitting={submitting}
      error={formError}
    >
      <TextField
        label="Actual cost"
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        hint="In dollars, such as 12.34. Leave it blank if it cost nothing."
        value={costText}
        onChange={(event) => {
          setCostText(event.target.value);
          clearErrors("amountCents");
        }}
        error={errors.amountCents}
      />
      {isPersonal ? null : (
        <SplitEditor
          members={members}
          payerId={currentUserId}
          amountCents={blank ? null : amountCents}
          state={split}
          onChange={(next) => {
            setSplit(next);
            clearErrors("sharedBy", "amountsCents", "mode");
          }}
          error={errors.sharedBy ?? errors.amountsCents ?? errors.mode}
        />
      )}
    </FormSheet>
  );
}
