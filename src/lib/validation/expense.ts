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
