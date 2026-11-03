import { NextResponse, type NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { readJson } from "@/lib/http/read-json";
import { createGroup, listGroups } from "@/lib/services/group-service";
import { createGroupSchema } from "@/lib/validation/group";
import { parseInput } from "@/lib/validation/parse";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const groups = await listGroups(userId);
    return NextResponse.json({ groups });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    const input = parseInput(createGroupSchema, await readJson(request));
    const group = await createGroup(userId, input);
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
