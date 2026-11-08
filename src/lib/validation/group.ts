import { z } from "zod";
import { emailSchema } from "./auth";

// The path parameter of every /api/groups/{groupId} route. A malformed id is
// rejected here, so the database is only ever asked about real UUIDs.
export const groupParamsSchema = z.object({
  groupId: z.uuid({ error: "Group id must be a UUID." }),
});

// Weights are ratios, so 100 covers any whole-percent split. The database has
// the same cap (group_members_weight_at_most_100), which keeps
// amount × total weight a safe integer in lib/domain/splits.ts.
export const MAX_SHARE_WEIGHT = 100;

const enterName = "Enter a group name.";
const name = z
  .string({ error: enterName })
  .trim()
  .min(1, { error: enterName })
  .max(60, { error: "Group name must be at most 60 characters." });

const weightMessage = `Each weight must be a whole number from 1 to ${MAX_SHARE_WEIGHT}.`;

// z.uuid accepts uppercase, but Postgres uuid ignores case, so ids are
// lowercased before the duplicate check and come out lowercase.
const memberWeights = z
  .array(
    z.object({
      userId: z
        .uuid({ error: "Each member must be a user id." })
        .transform((id) => id.toLowerCase()),
      weight: z
        .number({ error: weightMessage })
        .int({ error: weightMessage })
        .min(1, { error: weightMessage })
        .max(MAX_SHARE_WEIGHT, { error: weightMessage }),
    }),
    { error: "List a weight for every current member." },
  )
  .min(1, { error: "List a weight for every current member." })
  .refine(
    (entries) =>
      new Set(entries.map((entry) => entry.userId)).size === entries.length,
    { error: "List each member once." },
  );

export const createGroupSchema = z.object({ name });

export const inviteSchema = z.object({ email: emailSchema });

// PATCH /api/groups/{groupId}: a new name, a new default ratio, or both. The
// service checks that memberWeights lists exactly the current members.
export const updateGroupSchema = z
  .object({ name: name.optional(), memberWeights: memberWeights.optional() })
  .refine(
    (input) => input.name !== undefined || input.memberWeights !== undefined,
    { error: "Send a new name or new weights." },
  );

export type CreateGroupInput = z.output<typeof createGroupSchema>;
export type InviteInput = z.output<typeof inviteSchema>;
export type UpdateGroupInput = z.output<typeof updateGroupSchema>;

// GET /api/groups/{groupId}/bills/me: which closed period, or none for the
// current one (#21).
export const billQuerySchema = z.object({
  settlementId: z
    .uuid({ error: "settlementId must be the id of a past period." })
    .optional(),
});
