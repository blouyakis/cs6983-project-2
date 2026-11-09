"use client";

import { useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import type { Member } from "@/lib/db/group-members";
import { patchJson } from "@/lib/http/api-client";
import {
  initialDefaultSplit,
  resolveDefaultSplit,
  type DefaultSplitErrors,
  type DefaultSplitState,
} from "./default-split";

type DefaultSplitFormProps = {
  groupId: string;
  // The current members, with their weights.
  members: Member[];
  open: boolean;
  onClose: () => void;
  onSaved: (weights: number[]) => void;
  // Called when the server says the weights don't list the current members,
  // because someone joined or left after the form opened. The parent fetches
  // the members again and passes them in; the form stays open.
  onMembersChanged: () => void;
};

export const MEMBERS_CHANGED =
  "The group's members changed while you were editing. The form now lists everyone; check the split and save again.";

const MODES = [
  { value: "even", label: "Evenly" },
  { value: "custom", label: "Custom percentages" },
] as const;

// Sets the group's default split (DESIGN.md "DefaultSplitForm", #63): Evenly,
// or a whole percent for each current member that together make 100. It opens
// on the group's current ratio and sends every current member once in one
// PATCH. Render it again for each opening, so it starts from the weights.
export function DefaultSplitForm({
  groupId,
  members,
  open,
  onClose,
  onSaved,
  onMembersChanged,
}: DefaultSplitFormProps) {
  const [state, setState] = useState<DefaultSplitState>(() =>
    initialDefaultSplit(members),
  );
  const [errors, setErrors] = useState<DefaultSplitErrors>({});
  const [serverError, setServerError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const total = members.reduce((sum, member) => {
    const typed = Number((state.percents[member.userId] ?? "").trim());
    return Number.isInteger(typed) ? sum + typed : sum;
  }, 0);

  async function handleSubmit() {
    setServerError(undefined);
    const resolved = resolveDefaultSplit(state, members);
    if ("errors" in resolved) {
      setErrors(resolved.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await patchJson(`/api/groups/${groupId}`, resolved);
    setSubmitting(false);
    if (!result.ok) {
      // update_group's field error has no field here to sit next to, so it
      // gets a message that says what happened and what to do.
      if (result.error.fields?.memberWeights) {
        setServerError(MEMBERS_CHANGED);
        onMembersChanged();
        return;
      }
      setServerError(result.error.message);
      return;
    }
    onSaved(resolved.memberWeights.map((entry) => entry.weight));
    onClose();
  }

  return (
    <FormSheet
      open={open}
      title="Default split"
      primaryLabel="Save split"
      onSubmit={handleSubmit}
      onClose={onClose}
      submitting={submitting}
      error={serverError ?? errors.total}
    >
      <p className="text-sm text-muted">
        New costs in this group start from this split. Anyone can change it on a
        single cost.
      </p>
      <Toggle
        label="How to split"
        name="default-split-mode"
        options={MODES}
        value={state.mode}
        onChange={(mode) => {
          setErrors({});
          setState((current) => ({ ...current, mode }));
        }}
      />
      {state.mode === "custom" ? (
        <>
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.userId}>
                <TextField
                  label={`${member.name} (%)`}
                  name={`percent-${member.userId}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={state.percents[member.userId] ?? ""}
                  error={errors[member.userId]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setState((current) => ({
                      ...current,
                      percents: { ...current.percents, [member.userId]: value },
                    }));
                  }}
                />
              </li>
            ))}
          </ul>
          <p className="font-semibold">Total: {total}%</p>
        </>
      ) : (
        <p>Everyone shares new costs equally.</p>
      )}
    </FormSheet>
  );
}
