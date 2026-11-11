import { z } from "zod";
import { MAX_CENTS, splitMessages } from "@/lib/domain/splits";
import { splitSchema } from "./splits";

// The body of POST /api/groups/{groupId}/expenses (#7). The split fields sit
// at the top level, next to the expense's own, because parseInput keys each
// error by the first part of its path. There is no payer: the payer is always
// the current user, and a payerId in the body is dropped here as an unknown key
// (AGENTS.md Section 6.7).

const enterDescription = "Enter what this cost was for.";
const description = z
  .string({ error: enterDescription })
  .trim()
  .min(1, { error: enterDescription })
  .max(100, { error: "The description must be at most 100 characters." });

// The same message as lib/domain/splits.ts, so the field reads the same
// whichever layer catches it.
const amountCents = z
  .number({ error: splitMessages.amount })
  .int({ error: splitMessages.amount })
  .min(0, { error: splitMessages.amount })
  .max(MAX_CENTS, { error: splitMessages.amount });

const enterDay = "Enter the day this was spent, such as 2026-11-02.";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  // Date rolls 2026-02-30 over to March, so a real day survives the round trip.
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

// A day is a calendar date with no time zone, so "today" depends on where the
// user is. Someone east of UTC is already on the next date for part of the
// day, so the latest day allowed is tomorrow in UTC, the furthest ahead any
// time zone can be.
function isTooFarAhead(day: string): boolean {
  const latest = new Date(Date.now() + ONE_DAY_MS).toISOString().slice(0, 10);
  return day > latest;
}

const spentOn = z
  .string({ error: enterDay })
  .refine(isCalendarDay, { error: enterDay })
  .refine((day) => !isTooFarAhead(day), {
    error: "The day can't be in the future.",
  });

export const createExpenseSchema = z
  .object({ description, amountCents, spentOn })
  .and(splitSchema);

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// The body of PATCH /api/groups/{groupId}/expenses/{expenseId} (#20). An edit
// replaces the description, amount, day and split together, so it takes the
// same fields as creating. There is still no payer: it can't be changed
// (AGENTS.md Section 6.7), and one sent anyway is dropped.
export const updateExpenseSchema = createExpenseSchema;

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// The path parameters of /api/groups/{groupId}/expenses/{expenseId}.
export const expenseParamsSchema = z.object({
  groupId: z.uuid({ error: "Group id must be a UUID." }),
  expenseId: z.uuid({ error: "Expense id must be a UUID." }),
});

// The query of GET /api/expenses and of the overview's filters (#15): which
// group, who paid, and the days from and to, in any combination. A filter
// form sends every field, so an empty one counts as not set. There is no user
// id: the history is always the session user's (AGENTS.md Section 8).
const enterFilterDay = "Enter a day such as 2026-11-02.";

function optionalFilter<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional(),
  );
}

// Postgres compares uuids in any case, but the service matches ids as
// strings, so they come out lowercase, as in lib/validation/splits.ts.
const lower = (id: string) => id.toLowerCase();

const filterDay = z
  .string({ error: enterFilterDay })
  .refine(isCalendarDay, { error: enterFilterDay });

export const expenseHistoryQuerySchema = z
  .object({
    groupId: optionalFilter(
      z.uuid({ error: "Choose one of your groups." }).transform(lower),
    ),
    paidBy: optionalFilter(
      z.uuid({ error: "Choose who paid." }).transform(lower),
    ),
    from: optionalFilter(filterDay),
    to: optionalFilter(filterDay),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    path: ["to"],
    error: "To can't be before From.",
  });

export type ExpenseHistoryFilters = z.output<typeof expenseHistoryQuerySchema>;
