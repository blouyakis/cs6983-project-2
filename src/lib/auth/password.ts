import "server-only";
import { compare, hash } from "bcryptjs";

const COST_FACTOR = 12;

// Compared against when the email is unknown, so a failed login takes as
// long whether or not the account exists.
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return hash(password, COST_FACTOR);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (passwordHash === null) {
    dummyHash ??= hash("lifeboard-dummy-password", COST_FACTOR);
    await compare(password, await dummyHash);
    return false;
  }
  return compare(password, passwordHash);
}
