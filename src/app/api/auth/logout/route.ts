import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";

// Logging out needs no valid session: an expired cookie is cleared the same way.
export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
