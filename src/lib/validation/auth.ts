import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt ignores everything after the first 72 bytes.
const MAX_PASSWORD_BYTES = 72;

const emailMessage = "Enter a valid email address.";

const email = z
  .string({ error: emailMessage })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: emailMessage }));

export const registerSchema = z.object({
  name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(1, { error: "Enter your name." })
    .max(100, { error: "Name must be at most 100 characters." }),
  email,
  password: z
    .string({ error: "Enter a password." })
    .min(MIN_PASSWORD_LENGTH, {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    })
    .refine(
      (password) =>
        new TextEncoder().encode(password).length <= MAX_PASSWORD_BYTES,
      { error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes.` },
    ),
});

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: "Enter your password." })
    .min(1, { error: "Enter your password." }),
});

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
