import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/auth/schemas";
import { PUBLIC_USER_COLUMNS, setSessionCookie } from "@/lib/auth/session";
import { signToken } from "@/lib/auth/token";

const UNIQUE_VIOLATION = "23505";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;
  const name = parsed.data.name ?? email.split("@")[0];

  const db = getDb();
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Email is already registered." },
      { status: 409 },
    );
  }

  const { data: user, error } = await db
    .from("users")
    .insert({ email, name, password_hash: await hashPassword(password) })
    .select(PUBLIC_USER_COLUMNS)
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "Email is already registered." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Could not register." }, { status: 500 });
  }

  const token = await signToken(user.id);
  const res = NextResponse.json({ user, token }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
