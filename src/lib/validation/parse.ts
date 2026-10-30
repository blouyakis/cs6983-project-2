import type { z } from "zod";
import { ValidationError, type FieldErrors } from "@/lib/http/errors";

export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const fields: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in fields)) {
      fields[field] = issue.message;
    }
  }
  throw new ValidationError("Check the highlighted fields.", fields);
}
