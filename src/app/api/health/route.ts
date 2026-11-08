import { connection, NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db/health";

// Public, so it says only up or down (#100): no error message, version or
// environment name.
export async function GET() {
  // With cacheComponents on, a GET handler can be prerendered at build time.
  // connection() makes it run on every request, and no-store keeps the CDN
  // from serving an old answer.
  await connection();
  const up = await pingDatabase();
  if (!up) {
    console.error("Health check: the database did not answer.");
  }
  return NextResponse.json(
    { status: up ? "ok" : "error" },
    { status: up ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
