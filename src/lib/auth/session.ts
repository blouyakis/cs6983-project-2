import "server-only";
import { SignJWT, errors, jwtVerify } from "jose";
import { UnauthorizedError } from "@/lib/http/errors";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

const MIN_SECRET_LENGTH = 32;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is required and must be at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string): Promise<string> {
  const secret = getSecret();
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(secret);
}

export async function verifySession(
  token: string | undefined,
): Promise<string> {
  if (!token) {
    throw new UnauthorizedError();
  }
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.sub) {
      throw new UnauthorizedError();
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new UnauthorizedError(
        "Your session has expired. Please log in again.",
      );
    }
    throw new UnauthorizedError();
  }
}
