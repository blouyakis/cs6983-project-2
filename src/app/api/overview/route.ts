import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { getOverview } from "@/lib/services/overview-service";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const overview = await getOverview(userId);
    return NextResponse.json({ overview });
  } catch (error) {
    return toErrorResponse(error);
  }
}
