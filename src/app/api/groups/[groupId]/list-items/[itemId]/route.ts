import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { editListItem, removeListItem } from "@/lib/services/list-item-service";
import {
  listItemParamsSchema,
  updateListItemSchema,
} from "@/lib/validation/list-item";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string; itemId: string }> };

// Any current member can edit an open item. A done item is 409 until it is
// unchecked (#12).
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, itemId } = parseInput(
      listItemParamsSchema,
      await context.params,
    );
    const changes = parseInput(updateListItemSchema, await readJson(request));
    const item = await editListItem(userId, groupId, itemId, changes);
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId, itemId } = parseInput(
      listItemParamsSchema,
      await context.params,
    );
    await removeListItem(userId, groupId, itemId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
