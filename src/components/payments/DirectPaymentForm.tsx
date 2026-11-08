"use client";

import { useState } from "react";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { FormSheet } from "@/components/ui/FormSheet";
import { TextField } from "@/components/ui/TextField";
import type { Member } from "@/lib/db/group-members";
import type { Payment } from "@/lib/db/settlements";
import { parseDollars } from "@/lib/domain/money";
import { postJson } from "@/lib/http/api-client";
import { ValidationError } from "@/lib/http/errors";
import { parseInput } from "@/lib/validation/parse";
import {
  createPaymentSchema,
  type CreatePaymentInput,
} from "@/lib/validation/payment";

type DirectPaymentFormProps = {
  groupId: string;
  // The group's current members, the viewer among them.
  members: Member[];
  currentUserId: string;
  open: boolean;
  onClose: () => void;
  onRecorded: (payment: Payment) => void;
};

type Errors = Partial<Record<keyof CreatePaymentInput, string>>;

// The payment form behind PayDirectlyCard (#14, DESIGN.md "PayDirectlyCard"):
// who the viewer paid and how much. The viewer is always the sender, so the
// body never names one. The server checks everything again.
export function DirectPaymentForm({
  groupId,
  members,
  currentUserId,
  open,
  onClose,
  onRecorded,
}: DirectPaymentFormProps) {
  const others = members.filter((member) => member.userId !== currentUserId);
  // With one other member there is nobody else to choose.
  const preselected = others.length === 1 ? others[0].userId : null;
  const [toUserId, setToUserId] = useState<string | null>(preselected);
  const [amountText, setAmountText] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setToUserId(preselected);
    setAmountText("");
    setErrors({});
    setFormError(undefined);
    onClose();
  }

  async function handleSubmit() {
    let body: CreatePaymentInput;
    try {
      body = parseInput(createPaymentSchema, {
        toUserId: toUserId ?? undefined,
        amountCents: parseDollars(amountText) ?? undefined,
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
    const result = await postJson<{ payment: Payment }>(
      `/api/groups/${groupId}/payments`,
      body,
    );
    setSubmitting(false);
    if (result.ok) {
      onRecorded(result.data.payment);
      close();
      return;
    }
    setErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? undefined : result.error.message);
  }

  return (
    <FormSheet
      open={open}
      title="Pay one person directly"
      primaryLabel="Record payment"
      onSubmit={handleSubmit}
      onClose={close}
      submitting={submitting}
      error={formError}
    >
      <p className="text-sm text-muted">
        Record money you already sent (Venmo, cash…). It counts once they
        confirm it. LifeBoard never moves money.
      </p>
      <ChipPicker
        label="Who did you pay?"
        name="toUserId"
        options={others.map((member) => ({
          value: member.userId,
          label: member.name,
        }))}
        selected={toUserId ? [toUserId] : []}
        onChange={([chosen]) => {
          setToUserId(chosen ?? null);
          setErrors((old) => ({ ...old, toUserId: undefined }));
        }}
        error={errors.toUserId ?? ""}
      />
      <TextField
        label="Amount"
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        hint="In dollars, such as 12.34."
        value={amountText}
        onChange={(event) => {
          setAmountText(event.target.value);
          setErrors((old) => ({ ...old, amountCents: undefined }));
        }}
        error={errors.amountCents}
      />
    </FormSheet>
  );
}
