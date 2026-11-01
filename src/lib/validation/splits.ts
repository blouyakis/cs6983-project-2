import { z } from "zod";
import { splitMessages } from "@/lib/domain/splits";

// The split fields of any request that records an expense: adding one (#7),
// checking off a list item (#12) and editing one (#20). They sit at the top
// level of the body, because parseInput keys each error by the first part of
// its path. Rules that need the amount or the payer, such as the shares adding
// up, are checked in lib/domain/splits.ts.

const choose = "Choose who shares this cost.";

const sharedBy = z
  .array(z.uuid({ error: choose }), { error: choose })
  .min(1, { error: splitMessages.noSharers })
  .refine((ids) => new Set(ids).size === ids.length, {
    error: splitMessages.repeatedSharer,
  });

const amountsCents = z.record(
  z.uuid({ error: choose }),
  z
    .number({ error: splitMessages.shareNotWholeCents })
    .int({ error: splitMessages.shareNotWholeCents })
    .min(0, { error: splitMessages.shareNotWholeCents }),
  // A bad key is reported with the record's own error, so pick by issue code.
  {
    error: (issue) =>
      issue.code === "invalid_key" ? choose : splitMessages.missingShare,
  },
);

export const splitSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({ mode: z.literal("even"), sharedBy }),
    z.object({ mode: z.literal("custom"), sharedBy, amountsCents }),
  ],
  { error: "Choose Evenly or Custom amounts." },
);

export type SplitInput = z.infer<typeof splitSchema>;
