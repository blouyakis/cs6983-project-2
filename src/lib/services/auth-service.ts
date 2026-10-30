import "server-only";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/session";
import {
  findUserByEmail,
  findUserById,
  insertUser,
  type User,
} from "@/lib/db/users";
import { ConflictError, UnauthorizedError } from "@/lib/http/errors";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";

export type AuthResult = { user: User; token: string };

const LOGIN_FAILED = "Email or password is incorrect.";

export async function register(input: RegisterInput): Promise<AuthResult> {
  if (await findUserByEmail(input.email)) {
    throw new ConflictError("An account with this email already exists.");
  }
  // insertUser also throws ConflictError if another request takes the email
  // between the check above and the insert.
  // TODO(#23): create the user's personal space in the same transaction.
  const user = await insertUser({
    email: input.email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
  });
  return { user, token: await signSession(user.id) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const found = await findUserByEmail(input.email);
  const passwordMatches = await verifyPassword(
    input.password,
    found?.passwordHash ?? null,
  );
  if (!found || !passwordMatches) {
    throw new UnauthorizedError(LOGIN_FAILED);
  }
  const user: User = {
    id: found.id,
    email: found.email,
    name: found.name,
    createdAt: found.createdAt,
    updatedAt: found.updatedAt,
  };
  return { user, token: await signSession(user.id) };
}

export async function getCurrentUser(userId: string): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
