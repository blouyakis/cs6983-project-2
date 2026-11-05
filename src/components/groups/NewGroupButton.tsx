"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextField } from "@/components/ui/TextField";
import { postJson } from "@/lib/http/api-client";

type Created = { group: { id: string } };

// The New group button and its form. The creator becomes the first member,
// then lands on the new group's page to invite people.
export function NewGroupButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  function close() {
    setOpen(false);
    setNameError(undefined);
    setFormError(undefined);
  }

  async function handleSubmit(data: FormData) {
    setSubmitting(true);
    const result = await postJson<Created>("/api/groups", {
      name: data.get("name"),
    });
    if (result.ok) {
      // Close first: Next keeps this page mounted after navigating, and a
      // modal left open would make the new group's page inert.
      setSubmitting(false);
      close();
      router.push(`/groups/${result.data.group.id}`);
      // The sidebar's group list lives in the shared layout, which a push
      // alone leaves as it is, so refetch the server components too (#53).
      router.refresh();
      return;
    }
    setSubmitting(false);
    setNameError(result.error.fields?.name);
    setFormError(result.error.fields ? undefined : result.error.message);
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)}>
        <span aria-hidden="true">✨ </span>New group
      </PrimaryButton>
      <FormSheet
        open={open}
        title="New group"
        primaryLabel="Create group"
        onSubmit={handleSubmit}
        onClose={close}
        submitting={submitting}
        error={formError}
      >
        <TextField
          label="Name"
          name="name"
          maxLength={60}
          autoComplete="off"
          hint="Anything: a home, a trip, a standing date. Start with an emoji to give it a tile."
          error={nameError}
        />
      </FormSheet>
    </>
  );
}
