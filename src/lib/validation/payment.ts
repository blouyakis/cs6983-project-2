import { z } from "zod";

// The path parameters of /api/groups/{groupId}/payments/{paymentId} routes.
export const paymentParamsSchema = z.object({
  groupId: z.uuid({ error: "Group id must be a UUID." }),
  paymentId: z.uuid({ error: "Payment id must be a UUID." }),
});
