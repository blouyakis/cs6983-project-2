import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import {
  addListItem,
  listGroupListItems,
} from "@/lib/services/list-item-service";
import { groupParamsSchema } from "@/lib/validation/group";
import { createListItemSchema } from "@/lib/validation/list-item";
import { parseInput } from "@/lib/validation/parse";

type Context = { params: Promise<{ groupId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    return NextResponse.json({
      items: await listGroupListItems(userId, groupId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// The item is added by the session user. An addedBy in the body is dropped by
// the schema.
export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireSessionUserId(request);
    const { groupId } = parseInput(groupParamsSchema, await context.params);
    const input = parseInput(createListItemSchema, await readJson(request));
    const item = await addListItem(userId, groupId, input);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
