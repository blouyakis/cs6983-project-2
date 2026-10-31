import { z } from "zod";

// The path parameter of every /api/groups/{groupId} route. A malformed id is
// rejected here, so the database is only ever asked about real UUIDs.
export const groupParamsSchema = z.object({
  groupId: z.uuid({ error: "Group id must be a UUID." }),
});
