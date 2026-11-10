import Link from "next/link";
import { useId } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/http/errors";

export type ExpenseFilterValues = {
  groupId: string;
  paidBy: string;
  from: string;
  to: string;
};

type ExpenseFiltersProps = {
  // Where the form sends its fields, and where Clear filters goes.
  action: string;
  groups: { id: string; name: string }[];
  payers: { userId: string; name: string }[];
  // What is in each field now, as it came from the address.
  values: ExpenseFilterValues;
  // A message for each field the server refused, next to that field.
  errors: FieldErrors;
  // How many expenses match, or null when the filters couldn't be applied.
  count: number | null;
};

const SELECT =
  "rounded-lg border-2 border-ink bg-surface px-3 py-2 text-ink aria-invalid:border-owe";

function countLabel(count: number): string {
  if (count === 0) {
    return "No expenses match";
  }
  return count === 1 ? "1 expense matches" : `${count} expenses match`;
}

type SelectFieldProps = {
  label: string;
  name: string;
  anyLabel: string;
  options: { value: string; label: string }[];
  value: string;
  error?: string;
};

// A labelled <select> with its error next to it, like TextField.
function SelectField({
  label,
  name,
  anyLabel,
  options,
  value,
  error,
}: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  // A value that isn't one of the options, such as a group the user isn't
  // in, falls back to the first option instead of an empty box.
  const known = options.some((option) => option.value === value);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={known ? value : ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={SELECT}
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={errorId} aria-live="polite" className="text-sm text-owe">
        {error}
      </p>
    </div>
  );
}

// The filters above the expense table (#15, DESIGN.md "ExpenseFilters"):
// Group, Paid by, From and To, and how many expenses match. It is a plain GET
// form, so the filters live in the address: they survive a reload, can be
// shared, and work before any script has loaded. The server does the
// filtering; this only shows what it was asked and what it answered.
export function ExpenseFilters({
  action,
  groups,
  payers,
  values,
  errors,
  count,
}: ExpenseFiltersProps) {
  const filtered = Object.values(values).some((value) => value !== "");
  return (
    <form
      method="get"
      action={action}
      aria-label="Filter expenses"
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SelectField
          label="Group"
          name="groupId"
          anyLabel="All groups"
          options={groups.map((group) => ({
            value: group.id,
            label: group.name,
          }))}
          value={values.groupId}
          error={errors.groupId}
        />
        <SelectField
          label="Paid by"
          name="paidBy"
          anyLabel="Anyone"
          options={payers.map((payer) => ({
            value: payer.userId,
            label: payer.name,
          }))}
          value={values.paidBy}
          error={errors.paidBy}
        />
        <TextField
          label="From"
          name="from"
          type="date"
          defaultValue={values.from}
          error={errors.from}
        />
        <TextField
          label="To"
          name="to"
          type="date"
          defaultValue={values.to}
          error={errors.to}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <PrimaryButton type="submit">Apply filters</PrimaryButton>
        {filtered ? (
          <Link href={action} className="font-semibold underline">
            Clear filters
          </Link>
        ) : null}
        {/* Not a status region: the page is rendered again for each set of
            filters, so there is no change to announce, and the page's one
            notice stays the only status. */}
        <p className="font-semibold">
          {count === null
            ? "Fix the highlighted filters to see your expenses."
            : `${countLabel(count)}${filtered ? " these filters" : ""}.`}
        </p>
      </div>
    </form>
  );
}
