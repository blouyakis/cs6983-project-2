"use client";

import { describeSplit } from "@/lib/domain/describe-split";
import { useDefaultSplit } from "./DefaultSplitProvider";

// The group's default split in words, next to MemberList, with a button that
// opens DefaultSplitForm (DESIGN.md "DefaultSplitControl", #63). Render it
// inside DefaultSplitProvider.
export function DefaultSplitControl() {
  const split = useDefaultSplit();
  if (!split) {
    return null;
  }
  const words = describeSplit(
    split.members.map((member) => member.defaultShareWeight),
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="font-semibold">Default split: {words}</p>
      <button
        type="button"
        onClick={split.openForm}
        aria-label="Change the default split"
        className="rounded-lg border-2 border-ink bg-surface px-3 py-1 font-semibold"
      >
        Change
      </button>
    </div>
  );
}
