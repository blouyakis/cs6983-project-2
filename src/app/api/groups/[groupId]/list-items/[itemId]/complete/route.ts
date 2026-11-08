import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { completeListItem } from "@/lib/services/list-item-service";
import { listItemParamsSchema } from "@/lib/validation/list-item";
import { completeItemSchema } from "@/lib/validation/list-item";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string; itemId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, itemId } = parseInput(
      listItemParamsSchema,
      await context.params,
    );
    const input = parseInput(completeItemSchema, await readJson(request));
    const item = await completeListItem(userId, groupId, itemId, input);
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}
