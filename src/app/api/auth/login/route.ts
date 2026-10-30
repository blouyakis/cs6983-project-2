import { NextResponse, type NextRequest } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { login } from "@/lib/services/auth-service";
import { loginSchema } from "@/lib/validation/auth";
import { parseInput } from "@/lib/validation/parse";

export async function POST(request: NextRequest) {
  try {
    const input = parseInput(loginSchema, await readJson(request));
    const { user, token } = await login(input);
    const response = NextResponse.json({ user });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
