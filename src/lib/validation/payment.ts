import { z } from "zod";
import { formatCents } from "@/lib/domain/money";
import { MAX_CENTS } from "@/lib/domain/splits";

// The path parameters of /api/groups/{groupId}/payments/{paymentId} routes.
export const paymentParamsSchema = z.object({
  groupId: z.uuid({ error: "Group id must be a UUID." }),
  paymentId: z.uuid({ error: "Payment id must be a UUID." }),
});

// The body of POST /api/groups/{groupId}/payments (#14). There is no sender:
// the sender is always the current user, and a fromUserId in the body is
// dropped here as an unknown key (AGENTS.md Section 8).
const amountMessage = `Enter an amount from ${formatCents(1)} to ${formatCents(MAX_CENTS)}.`;

export const createPaymentSchema = z.object({
  toUserId: z.uuid({ error: "Choose who you paid." }),
  amountCents: z
    .number({ error: amountMessage })
    .int({ error: amountMessage })
    .min(1, { error: amountMessage })
    .max(MAX_CENTS, { error: amountMessage }),
});
