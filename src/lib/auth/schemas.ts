import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const registerSchema = z.object({
  email,
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().trim().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
