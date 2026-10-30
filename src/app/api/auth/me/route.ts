import { NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth/session";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}
