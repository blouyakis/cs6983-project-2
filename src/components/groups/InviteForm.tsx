"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextField } from "@/components/ui/TextField";
import { toPercents } from "@/lib/domain/describe-split";
import { postJson } from "@/lib/http/api-client";
import { useDefaultSplit } from "./DefaultSplitProvider";

type Invited = { member: { name: string }; splitReset: boolean };

// An email field and an Invite button (DESIGN.md "InviteForm"). The invitee
// joins right away. Not shown in a personal space or a read-only group. When
// joining reset an uneven split to even, it says so and offers the Default
// split form (#63).
export function InviteForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const split = useDefaultSplit();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [joined, setJoined] = useState("");
  // Set when joining reset the split: what it was, and how many saves the
  // Default split form had made then. A later save makes it out of date.
  const [reset, setReset] = useState<{ before: string; saves: number }>();

  // The reset message holds only until the Default split form saves again.
  const stillEven = reset !== undefined && reset.saves === (split?.saves ?? 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(undefined);
    setJoined("");
    setReset(undefined);
    // The ratio before this join, from the weights the page was rendered with.
    const before = split?.members ?? [];
    const result = await postJson<Invited>(
      `/api/groups/${groupId}/invitations`,
      { email: new FormData(form).get("email") },
    );
    setPending(false);
    if (result.ok) {
      form.reset();
      setJoined(result.data.member.name);
      if (result.data.splitReset) {
        const ratio = toPercents(
          before.map((member) => member.defaultShareWeight),
        ).join("/");
        setReset({
          before: `${ratio} was set for ${before.length} people`,
          saves: split?.saves ?? 0,
        });
      }
      router.refresh();
      return;
    }
    // Every error here is about the email, so it sits next to that field.
    setError(result.error.fields?.email ?? result.error.message);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label="Invite a member"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="off"
            error={error}
          />
        </div>
        <PrimaryButton type="submit" disabled={pending} className="mt-7">
          Invite
        </PrimaryButton>
      </div>
      <p aria-live="polite" className="text-sm font-semibold text-action">
        {joined ? `${joined} joined the group.` : null}
        {joined && stillEven
          ? ` The default split is now even, because ${reset?.before}.`
          : null}
      </p>
      {stillEven && split ? (
        <button
          type="button"
          onClick={split.openForm}
          className="self-start text-sm font-semibold underline"
        >
          Set a new split
        </button>
      ) : null}
    </form>
  );
}
