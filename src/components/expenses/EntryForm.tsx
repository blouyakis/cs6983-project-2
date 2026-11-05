"use client";

import { useState } from "react";
import { ListItemInputs } from "@/components/lists/ListItemInputs";
import { readListItemFields } from "@/components/lists/list-item-fields";
import { FormSheet } from "@/components/ui/FormSheet";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import type { ListItem } from "@/lib/db/list-items";
import { parseDollars } from "@/lib/domain/money";
import { ValidationError } from "@/lib/http/errors";
import { postJson } from "@/lib/http/api-client";
import {
  createExpenseSchema,
  type CreateExpenseInput,
} from "@/lib/validation/expense";
import { parseInput } from "@/lib/validation/parse";
import { SplitEditor } from "./SplitEditor";
import {
  initialSplitState,
  resolveSplit,
  type SplitFields,
  type SplitState,
} from "./split-state";

// A group the user can add to, with its current members.
export type EntryGroup = {
  id: string;
  name: string;
  isPersonal: boolean;
  members: Member[];
};

// Plan it adds to a list (#11); Already spent logs a cost (#7).
export type EntryMode = "plan" | "spent";

const MODES = [
  { value: "plan", label: "Plan it" },
  { value: "spent", label: "Already spent" },
] as const;

type EntryFormProps = {
  groups: EntryGroup[];
  currentUserId: string;
  // The group the form was opened from. Otherwise the first one is chosen.
  defaultGroupId?: string;
  // The mode the form opens on. Already spent unless it was opened for a plan.
  initialMode?: EntryMode;
  open: boolean;
  onClose: () => void;
  onAdded: (expense: Expense, group: EntryGroup) => void;
  onPlanned?: (item: ListItem, group: EntryGroup) => void;
};

// The title and the amount are shared by both modes, so switching keeps what
// was typed: a plan's title and estimate, or a cost's description and amount.
type Fields = {
  mode: EntryMode;
  groupId: string;
  description: string;
  amountText: string;
  quantityText: string;
  note: string;
  spentOn: string;
  split: SplitState;
  // The members the split was made for. When they change, the split is made
  // again (see membersKey).
  splitKey: string;
};

// The user's calendar day, not UTC's, since that is the day they mean.
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// The page refreshes after someone is invited, and a group's ratio can change,
// so the members a split was made for can differ from the ones the form has
// now. A split made for other members would leave a new member out.
function membersKey(members: readonly Member[]): string {
  return JSON.stringify(
    members.map((member) => [member.userId, member.defaultShareWeight]),
  );
}

function blank(
  groups: EntryGroup[],
  defaultGroupId: string | undefined,
  mode: EntryMode,
): Fields {
  const group = groups.find((g) => g.id === defaultGroupId) ?? groups[0];
  return {
    mode,
    groupId: group?.id ?? "",
    description: "",
    amountText: "",
    quantityText: "",
    note: "",
    spentOn: today(),
    split: initialSplitState(group?.members ?? []),
    splitKey: membersKey(group?.members ?? []),
  };
}

// The New entry form (DESIGN.md "EntryForm"). Plan it adds an item to a list
// (#11), and Already spent logs a cost that was never on one (#7). The request
// is checked here with the same schema and split rules as the server, so a
// mistake is shown next to its field before anything is sent.
//
// Plan it has no day and no split, because list_items stores neither. The
// split is chosen when the item is checked off (#12).
export function EntryForm({
  groups,
  currentUserId,
  defaultGroupId,
  initialMode = "spent",
  open,
  onClose,
  onAdded,
  onPlanned,
}: EntryFormProps) {
  const [fields, setFields] = useState(() =>
    blank(groups, defaultGroupId, initialMode),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const group = groups.find((g) => g.id === fields.groupId) ?? groups[0];
  if (!group) {
    return null;
  }
  const amountCents = parseDollars(fields.amountText);
  const currentKey = membersKey(group.members);
  const split =
    fields.splitKey === currentKey
      ? fields.split
      : initialSplitState(group.members);

  const planning = fields.mode === "plan";

  function close() {
    setFields(blank(groups, defaultGroupId, initialMode));
    setErrors({});
    setFormError(undefined);
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

  function chooseGroup(groupId: string) {
    const chosen = groups.find((g) => g.id === groupId);
    if (chosen) {
      edit(
        {
          groupId,
          split: initialSplitState(chosen.members),
          splitKey: membersKey(chosen.members),
        },
        "sharedBy",
        "amountsCents",
        "mode",
      );
    }
  }

  function chooseMode(mode: EntryMode) {
    setFields((current) => ({ ...current, mode }));
    setErrors({});
    setFormError(undefined);
  }

  async function handlePlan() {
    const read = readListItemFields({
      title: fields.description,
      quantityText: fields.quantityText,
      note: fields.note,
      estimateText: fields.amountText,
    });
    if (!read.ok) {
      setErrors(read.errors);
      setFormError(undefined);
      return;
    }

    setSubmitting(true);
    const result = await postJson<{ item: ListItem }>(
      `/api/groups/${group.id}/list-items`,
      read.input,
    );
    setSubmitting(false);
    if (result.ok) {
      onPlanned?.(result.data.item, group);
      close();
      return;
    }
    setErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? undefined : result.error.message);
  }

  async function handleSubmit() {
    if (planning) {
      await handlePlan();
      return;
    }
    // A personal space has no split: the user is the only sharer (#23).
    const only: SplitFields = { mode: "even", sharedBy: [currentUserId] };
    const resolved =
      group.isPersonal || amountCents === null
        ? null
        : resolveSplit(split, group.members, currentUserId, amountCents);
    const splitFields =
      group.isPersonal || !resolved || "fieldErrors" in resolved
        ? only
        : resolved.fields;

    const problems: Record<string, string> = {};
    let body: CreateExpenseInput | undefined;
    try {
      body = parseInput(createExpenseSchema, {
        description: fields.description,
        amountCents: amountCents ?? undefined,
        spentOn: fields.spentOn,
        ...splitFields,
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
    const result = await postJson<{ expense: Expense }>(
      `/api/groups/${group.id}/expenses`,
      body,
    );
    setSubmitting(false);
    if (result.ok) {
      onAdded(result.data.expense, group);
      close();
      return;
    }
    setErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? undefined : result.error.message);
  }

  return (
    <FormSheet
      open={open}
      title="New entry"
      primaryLabel={planning ? "Add to list" : "Add expense"}
      onSubmit={handleSubmit}
      onClose={close}
      submitting={submitting}
      error={formError}
    >
      <p className="text-sm text-muted">
        Plan it first, or log what you already spent.
      </p>
      <Toggle
        label="Kind of entry"
        name="mode"
        options={MODES}
        value={fields.mode}
        onChange={chooseMode}
      />
      <ChipPicker
        label="Group"
        name="group"
        options={groups.map((g) => ({ value: g.id, label: g.name }))}
        selected={[group.id]}
        onChange={([groupId]) => chooseGroup(groupId)}
      />
      {planning ? (
        <ListItemInputs
          texts={{
            title: fields.description,
            estimateText: fields.amountText,
            quantityText: fields.quantityText,
            note: fields.note,
          }}
          errors={errors}
          onChange={(changes, cleared) =>
            edit(
              {
                ...(changes.title !== undefined
                  ? { description: changes.title }
                  : {}),
                ...(changes.estimateText !== undefined
                  ? { amountText: changes.estimateText }
                  : {}),
                ...(changes.quantityText !== undefined
                  ? { quantityText: changes.quantityText }
                  : {}),
                ...(changes.note !== undefined ? { note: changes.note } : {}),
              },
              cleared,
            )
          }
        />
      ) : (
        <>
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
            // No max: a day past it would fail the browser's own form check, which
            // blocks the submit and shows a tooltip instead of our message.
            value={fields.spentOn}
            onChange={(event) =>
              edit({ spentOn: event.target.value }, "spentOn")
            }
            error={errors.spentOn}
          />
          {group.isPersonal ? null : (
            <SplitEditor
              members={group.members}
              payerId={currentUserId}
              amountCents={amountCents}
              state={split}
              onChange={(next) =>
                edit(
                  { split: next, splitKey: currentKey },
                  "sharedBy",
                  "amountsCents",
                  "mode",
                )
              }
              error={errors.sharedBy ?? errors.amountsCents ?? errors.mode}
            />
          )}
        </>
      )}
    </FormSheet>
  );
}
