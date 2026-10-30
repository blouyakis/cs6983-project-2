import "server-only";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { SESSION_TTL_SECONDS, verifyToken } from "./token";

export const SESSION_COOKIE = "session";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export const PUBLIC_USER_COLUMNS = "id, email, name, created_at";

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function readToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }
  const cookies = req.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/** Resolves the logged-in user from the request, or null if unauthenticated. */
export async function getCurrentUser(req: Request): Promise<PublicUser | null> {
  const token = readToken(req);
  if (!token) return null;
  const userId = await verifyToken(token);
  if (!userId) return null;
  const { data } = await getDb()
    .from("users")
    .select(PUBLIC_USER_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
