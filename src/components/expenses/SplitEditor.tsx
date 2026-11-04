"use client";

import { ChipPicker } from "@/components/ui/ChipPicker";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import type { Member } from "@/lib/db/group-members";
import { formatCents } from "@/lib/domain/money";
import {
  amountTexts,
  chooseMode,
  chooseSharers,
  resolveSplit,
  typeAmount,
  type SplitState,
} from "./split-state";

type SplitEditorProps = {
  members: Member[];
  // The current user, who is always one of the sharers (AGENTS.md Section 6.2).
  payerId: string;
  // The expense amount as typed, or null while it isn't a valid amount yet.
  amountCents: number | null;
  state: SplitState;
  onChange: (state: SplitState) => void;
  // A message from the server about the split, shown under the editor.
  error?: string;
};

const MODES = [
  { value: "even", label: "Evenly" },
  { value: "custom", label: "Custom amounts" },
] as const;

// "How is it split?" (DESIGN.md "SplitEditor"). The preview is for display
// only: the server works the shares out again on save.
export function SplitEditor({
  members,
  payerId,
  amountCents,
  state,
  onChange,
  error,
}: SplitEditorProps) {
  const nameOf = (userId: string) =>
    userId === payerId
      ? "You"
      : (members.find((member) => member.userId === userId)?.name ?? "");
  const resolved =
    amountCents === null
      ? null
      : resolveSplit(state, members, payerId, amountCents);
  const texts = amountTexts(state, members, payerId, amountCents);
  // Only an even split has a leftover. Custom amounts have every cent entered.
  const leftoverCents =
    amountCents !== null && state.mode === "even"
      ? amountCents % state.sharedBy.length
      : 0;
  const problem =
    resolved && "fieldErrors" in resolved
      ? (resolved.fieldErrors.amountsCents ?? resolved.fieldErrors.sharedBy)
      : undefined;

  function labelOf(userId: string): string {
    if (userId !== payerId) {
      return nameOf(userId);
    }
    return leftoverCents > 0
      ? `You (paid, +${leftoverCents}¢ leftover)`
      : "You (paid)";
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">How is it split?</h3>
      <Toggle
        label="How is it split?"
        name="mode"
        options={MODES}
        value={state.mode}
        onChange={(mode) => onChange(chooseMode(state, mode))}
      />
      <ChipPicker
        label="Shared by"
        name="sharedBy"
        options={members.map((member) => ({
          value: member.userId,
          label: nameOf(member.userId),
        }))}
        selected={state.sharedBy}
        locked={[payerId]}
        onChange={(sharedBy) => onChange(chooseSharers(state, sharedBy))}
        multiple
      />
      {state.mode === "custom" ? (
        <div className="flex flex-col gap-2">
          {state.sharedBy.map((userId) => (
            <TextField
              key={userId}
              label={
                userId === payerId ? "Your share" : `${nameOf(userId)}'s share`
              }
              name={`amount-${userId}`}
              inputMode="decimal"
              autoComplete="off"
              value={texts[userId] ?? ""}
              onChange={(event) =>
                onChange(
                  typeAmount(
                    state,
                    members,
                    payerId,
                    amountCents,
                    userId,
                    event.target.value,
                  ),
                )
              }
            />
          ))}
        </div>
      ) : null}
      {resolved && "shares" in resolved ? (
        <ul
          aria-label="Preview"
          className="flex flex-col gap-1 border-t-2 border-dashed border-divider pt-2"
        >
          {resolved.shares.map((share) => (
            <li key={share.userId} className="flex justify-between gap-3">
              <span>{labelOf(share.userId)}</span>
              <span className="font-semibold">
                {formatCents(share.shareCents)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {amountCents === null ? (
        <p className="text-sm text-muted">
          Enter an amount to see how it is split.
        </p>
      ) : null}
      <p aria-live="polite" className="text-sm font-semibold text-owe">
        {problem ?? error}
      </p>
    </section>
  );
}
