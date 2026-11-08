import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { listSidebarGroups } from "@/lib/services/sidebar-service";

// The sidebar asks for this after each client navigation (#89), because the
// (app) layout it sits in isn't rendered again then.
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const groups = await listSidebarGroups(userId);
    return NextResponse.json(
      { groups },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
