import { connection, NextResponse } from "next/server";
import { checkHealth } from "@/lib/services/health-service";

// Public, so it says only up or down (#100): no error message, version or
// environment name. It needs no session, like register, login and logout.
export async function GET() {
  // With cacheComponents on, a GET handler can be prerendered at build time.
  // connection() makes it run on every request, and no-store keeps the CDN
  // from serving an old answer.
  await connection();
  const status = await checkHealth();
  return NextResponse.json(
    { status },
    {
      status: status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
