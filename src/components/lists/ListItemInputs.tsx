import { TextField } from "@/components/ui/TextField";
import type { ListItemTexts } from "./list-item-fields";

type ListItemInputsProps = {
  texts: ListItemTexts;
  // Keyed like the server's errors: title, estimatedCents, quantity, note.
  errors: Record<string, string>;
  // The changed text, and the error key to clear for it.
  onChange: (changes: Partial<ListItemTexts>, cleared: string) => void;
};

// A list item's fields, in the Plan it mode of EntryForm and in
// EditListItemForm, so both ask the same way.
export function ListItemInputs({
  texts,
  errors,
  onChange,
}: ListItemInputsProps) {
  return (
    <>
      <TextField
        label="What is it?"
        name="title"
        maxLength={100}
        autoComplete="off"
        placeholder="e.g. 🥛 Milk"
        value={texts.title}
        onChange={(event) => onChange({ title: event.target.value }, "title")}
        error={errors.title}
      />
      <TextField
        label="Estimated cost"
        name="estimate"
        inputMode="decimal"
        autoComplete="off"
        hint="Optional. In dollars, such as 12.34."
        value={texts.estimateText}
        onChange={(event) =>
          onChange({ estimateText: event.target.value }, "estimatedCents")
        }
        error={errors.estimatedCents}
      />
      <TextField
        label="Quantity"
        name="quantity"
        inputMode="numeric"
        autoComplete="off"
        hint="Optional."
        value={texts.quantityText}
        onChange={(event) =>
          onChange({ quantityText: event.target.value }, "quantity")
        }
        error={errors.quantity}
      />
      <TextField
        label="Note"
        name="note"
        maxLength={200}
        autoComplete="off"
        hint="Optional."
        value={texts.note}
        onChange={(event) => onChange({ note: event.target.value }, "note")}
        error={errors.note}
      />
    </>
  );
}
