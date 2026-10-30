import { NextResponse, type NextRequest } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { register } from "@/lib/services/auth-service";
import { registerSchema } from "@/lib/validation/auth";
import { parseInput } from "@/lib/validation/parse";

export async function POST(request: NextRequest) {
  try {
    const input = parseInput(registerSchema, await readJson(request));
    const { user, token } = await register(input);
    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
