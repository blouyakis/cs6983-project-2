import { z } from "zod";
import { formatCents } from "@/lib/domain/money";
import { MAX_CENTS } from "@/lib/domain/splits";

// The bodies of POST and PATCH /api/groups/{groupId}/list-items (#11). There
// is no addedBy: the item is always added by the current user, and an addedBy
// in the body is dropped here as an unknown key. Status, completedBy and the
// expense belong to checking off (#12), so they are dropped too.

export const listItemParamsSchema = z.object({
  groupId: z.uuid({ error: "Group id must be a UUID." }),
  itemId: z.uuid({ error: "Item id must be a UUID." }),
});

const enterTitle = "Enter what to do or buy.";
const title = z
  .string({ error: enterTitle })
  .trim()
  .min(1, { error: enterTitle })
  .max(100, { error: "The title must be at most 100 characters." });

// A blank note is no note, so the list never shows an empty one.
const note = z
  .string({ error: "The note must be text." })
  .trim()
  .max(200, { error: "The note must be at most 200 characters." })
  .transform((text) => (text === "" ? null : text))
  .nullable();

// list_items.quantity and estimated_cents are Postgres integer and must be
// above 0 (list_items_quantity_positive, list_items_estimate_positive). A
// quantity is a count, not money, so it has its own limit: the column's.
export const MAX_QUANTITY = 2_147_483_647;

const enterQuantity = "Enter a quantity of 1 or more, in whole units.";
const quantity = z
  .number({ error: enterQuantity })
  .int({ error: enterQuantity })
  .min(1, { error: enterQuantity })
  .max(MAX_QUANTITY, { error: enterQuantity })
  .nullable();

const enterEstimate = `Enter an estimate from ${formatCents(1)} to ${formatCents(MAX_CENTS)}, in whole cents.`;
const estimatedCents = z
  .number({ error: enterEstimate })
  .int({ error: enterEstimate })
  .min(1, { error: enterEstimate })
  .max(MAX_CENTS, { error: enterEstimate })
  .nullable();

export const createListItemSchema = z.object({
  title,
  quantity: quantity.default(null),
  note: note.default(null),
  estimatedCents: estimatedCents.default(null),
});

// Only the fields sent are changed. Null clears a quantity, note or estimate;
// the title can't be cleared.
export const updateListItemSchema = z
  .object({
    title: title.optional(),
    quantity: quantity.optional(),
    note: note.optional(),
    estimatedCents: estimatedCents.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    error: "Send at least one field to change.",
  });

export type CreateListItemInput = z.output<typeof createListItemSchema>;
export type UpdateListItemInput = z.output<typeof updateListItemSchema>;

// Check off a list item with a cost and split (#12)
export const completeItemSchema = z.object({
  amountCents: z
    .number({ error: "Enter an amount." })
    .int({ error: "Amount must be in whole cents." })
    .min(0, { error: "Amount must be 0 or more." })
    .max(MAX_CENTS, {
      error: `Amount must be at most ${formatCents(MAX_CENTS)}.`,
    }),
  shares: z.record(z.string().uuid(), z.number().int().min(0)),
});

export type CompleteItemInput = z.output<typeof completeItemSchema>;
