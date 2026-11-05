"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormSheet } from "@/components/ui/FormSheet";
import { TextField } from "@/components/ui/TextField";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import {
  centsToInputText,
  formatCents,
  parseDollars,
} from "@/lib/domain/money";
import { ValidationError } from "@/lib/http/errors";
import { deleteJson, patchJson } from "@/lib/http/api-client";
import {
  updateExpenseSchema,
  type UpdateExpenseInput,
} from "@/lib/validation/expense";
import { parseInput } from "@/lib/validation/parse";
import { SplitEditor } from "./SplitEditor";
import { resolveSplit, savedSplitState, type SplitState } from "./split-state";

type EditExpenseFormProps = {
  expense: Expense;
  groupName: string;
  // The group's current members, who are the people the cost can be shared by.
  members: Member[];
  currentUserId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
  onDeleted: () => void;
};

type Fields = {
  description: string;
  amountText: string;
  spentOn: string;
  split: SplitState;
};

function fromExpense(expense: Expense, members: Member[]): Fields {
  return {
    description: expense.description,
    amountText: centsToInputText(expense.amountCents),
    spentOn: expense.spentOn,
    split: savedSplitState(expense.shares, members),
  };
}

// The Edit expense form (DESIGN.md "EditExpenseForm"): description, amount,
// day and the split, for the payer of an unsettled expense. Who paid is shown
// as text and can't be changed (AGENTS.md Section 6.7). Delete… asks first
// with a ConfirmDialog. The request is checked here with the same schema and
// split rules as the server, so a mistake shows next to its field first.
export function EditExpenseForm({
  expense,
  groupName,
  members,
  currentUserId,
  open,
  onClose,
  onSaved,
  onDeleted,
}: EditExpenseFormProps) {
  const [fields, setFields] = useState(() => fromExpense(expense, members));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const amountCents = parseDollars(fields.amountText);
  const url = `/api/groups/${expense.groupId}/expenses/${expense.id}`;
  const payer =
    expense.payerId === currentUserId
      ? "You"
      : (members.find((member) => member.userId === expense.payerId)?.name ??
        "Someone who left");

  function close() {
    setFields(fromExpense(expense, members));
    setErrors({});
    setFormError(undefined);
    setConfirming(false);
    onClose();
  }

  // Typing in a field clears the error that was shown next to it.
  function edit(changes: Partial<Fields>, ...cleared: string[]) {
    setFields((current) => ({ ...current, ...changes }));
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => !cleared.includes(field)),
      ),
    );
  }

  async function handleSubmit() {
    const resolved =
      amountCents === null
        ? null
        : resolveSplit(fields.split, members, expense.payerId, amountCents);

    const problems: Record<string, string> = {};
    let body: UpdateExpenseInput | undefined;
    try {
      body = parseInput(updateExpenseSchema, {
        description: fields.description,
        amountCents: amountCents ?? undefined,
        spentOn: fields.spentOn,
        ...(resolved && "fields" in resolved
          ? resolved.fields
          : { mode: "even", sharedBy: fields.split.sharedBy }),
      });
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
      Object.assign(problems, error.fields);
    }
    if (resolved && "fieldErrors" in resolved) {
      Object.assign(problems, resolved.fieldErrors);
    }
    if (!body || Object.keys(problems).length > 0) {
      setErrors(problems);
      setFormError(undefined);
      return;
    }

    setSubmitting(true);
    const result = await patchJson<{ expense: Expense }>(url, body);
    setSubmitting(false);
    if (result.ok) {
      onSaved(result.data.expense);
      close();
      return;
    }
    setErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? undefined : result.error.message);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteJson(url);
    setDeleting(false);
    setConfirming(false);
    if (result.ok) {
      onDeleted();
      close();
      return;
    }
    setFormError(result.error.message);
  }

  return (
    <FormSheet
      open={open}
      title="Edit expense"
      primaryLabel="Save changes"
      onSubmit={handleSubmit}
      onClose={close}
      submitting={submitting}
      error={formError}
    >
      <p className="text-sm text-muted">
        In {groupName}, this period. {payer} paid, so{" "}
        {payer === "You" ? "you" : "they"} can edit it until it is settled. Who
        paid can&apos;t be changed: to fix that, delete it and add it again.
      </p>
      <TextField
        label="What was it for?"
        name="description"
        maxLength={100}
        autoComplete="off"
        value={fields.description}
        onChange={(event) =>
          edit({ description: event.target.value }, "description")
        }
        error={errors.description}
      />
      <TextField
        label="Amount"
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        hint="In dollars, such as 12.34."
        value={fields.amountText}
        onChange={(event) =>
          edit({ amountText: event.target.value }, "amountCents")
        }
        error={errors.amountCents}
      />
      <TextField
        label="Day"
        name="spentOn"
        type="date"
        value={fields.spentOn}
        onChange={(event) => edit({ spentOn: event.target.value }, "spentOn")}
        error={errors.spentOn}
      />
      <SplitEditor
        members={members}
        payerId={expense.payerId}
        amountCents={amountCents}
        state={fields.split}
        onChange={(next) =>
          edit({ split: next }, "sharedBy", "amountsCents", "mode")
        }
        error={errors.sharedBy ?? errors.amountsCents ?? errors.mode}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-owe p-3">
        <p className="text-sm font-semibold">
          Delete this expense? It comes off everyone&apos;s balance.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border-2 border-owe bg-surface px-4 py-2 font-semibold text-owe"
        >
          Delete…
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        message={`Delete ${expense.description}? Its ${formatCents(expense.amountCents)} comes off everyone's balance.`}
        confirmLabel="Delete expense"
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
        busy={deleting}
      />
    </FormSheet>
  );
}
