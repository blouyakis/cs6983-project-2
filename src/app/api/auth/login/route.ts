import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/schemas";
import { setSessionCookie } from "@/lib/auth/session";
import { signToken } from "@/lib/auth/token";

// Compared against when the email is unknown so response time doesn't reveal it.
const DUMMY_HASH =
  "$2b$10$96QAYVhsZFmi9GClqN7uxuJtM3RCzzmYcdCnUKgfWukP0hE6c8PFe";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  const { data: row } = await getDb()
    .from("users")
    .select("id, email, name, created_at, password_hash")
    .eq("email", email)
    .maybeSingle();

  const valid = await verifyPassword(
    password,
    row?.password_hash ?? DUMMY_HASH,
  );
  if (!row || !valid) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const { password_hash: _omit, ...user } = row;
  void _omit;
  const token = await signToken(user.id);
  const res = NextResponse.json({ user, token });
  setSessionCookie(res, token);
  return res;
}
