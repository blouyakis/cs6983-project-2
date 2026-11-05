import { parseDollars } from "@/lib/domain/money";
import { ValidationError } from "@/lib/http/errors";
import {
  createListItemSchema,
  type CreateListItemInput,
} from "@/lib/validation/list-item";
import { parseInput } from "@/lib/validation/parse";

// What the user typed into a list item's fields, in the Plan it mode of
// EntryForm and in EditListItemForm.
export type ListItemTexts = {
  title: string;
  quantityText: string;
  note: string;
  estimateText: string;
};

export type ListItemRead =
  | { ok: true; input: CreateListItemInput }
  | { ok: false; errors: Record<string, string> };

const WHOLE_NUMBER = /^\d+$/;

// Reads the fields with the same schema as the server, so a mistake is shown
// next to its field before anything is sent. A blank estimate or quantity is
// none. The errors are keyed like the server's, so its errors land on the
// same fields.
export function readListItemFields(texts: ListItemTexts): ListItemRead {
  const errors: Record<string, string> = {};
  const estimateText = texts.estimateText.trim();
  let estimatedCents: number | null = null;
  if (estimateText !== "") {
    const cents = parseDollars(estimateText);
    if (cents === null) {
      errors.estimatedCents = "Enter the estimate in dollars, such as 12.34.";
    } else {
      estimatedCents = cents;
    }
  }
  const quantityText = texts.quantityText.trim();
  // Anything that isn't digits is passed on as text, so the schema rejects it
  // with its own message.
  const quantity =
    quantityText === ""
      ? null
      : WHOLE_NUMBER.test(quantityText)
        ? Number(quantityText)
        : quantityText;

  try {
    const input = parseInput(createListItemSchema, {
      title: texts.title,
      quantity,
      note: texts.note,
      estimatedCents,
    });
    if (Object.keys(errors).length === 0) {
      return { ok: true, input };
    }
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw error;
    }
    Object.assign(errors, { ...error.fields, ...errors });
  }
  return { ok: false, errors };
}
