import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, verifySession } from "./session";

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
}

// Returns the user id from the session cookie, or throws UnauthorizedError.
export function requireSessionUserId(request: NextRequest): Promise<string> {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}
