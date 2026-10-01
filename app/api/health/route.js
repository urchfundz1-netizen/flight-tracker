import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Readiness check. Confirms the database is reachable and the schema is in
 * place, which is the most common cause of a deployment that builds fine but
 * fails every request.
 *
 * Reports only whether the check passed. Naming tables or the connection host
 * here would hand an attacker a map of the schema.
 */
export async function GET() {
  try {
    const row = await queryOne("SELECT 1 AS ok");

    if (Number(row?.ok) !== 1) {
      throw new Error("unexpected probe result");
    }

    return NextResponse.json(
      { ok: true, database: "reachable" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] database check failed:", error);

    return NextResponse.json(
      { ok: false, database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
