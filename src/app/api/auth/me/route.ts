import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { getCurrentUser } from "@/lib/services/auth-service";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const user = await getCurrentUser(userId);
    return NextResponse.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}
