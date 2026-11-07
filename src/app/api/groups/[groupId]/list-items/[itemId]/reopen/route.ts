import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { reopenListItem } from "@/lib/services/list-item-service";
import { listItemParamsSchema } from "@/lib/validation/list-item";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string; itemId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, itemId } = parseInput(
      listItemParamsSchema,
      await context.params,
    );
    const item = await reopenListItem(userId, groupId, itemId);
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}
