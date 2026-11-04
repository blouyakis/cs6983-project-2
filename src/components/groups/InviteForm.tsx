"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextField } from "@/components/ui/TextField";
import { postJson } from "@/lib/http/api-client";

type Invited = { member: { name: string } };

// An email field and an Invite button (DESIGN.md "InviteForm"). The invitee
// joins right away. Not shown in a personal space or a read-only group.
export function InviteForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [joined, setJoined] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(undefined);
    setJoined("");
    const result = await postJson<Invited>(
      `/api/groups/${groupId}/invitations`,
      { email: new FormData(form).get("email") },
    );
    setPending(false);
    if (result.ok) {
      form.reset();
      setJoined(`${result.data.member.name} joined the group.`);
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
        {joined}
      </p>
    </form>
  );
}
