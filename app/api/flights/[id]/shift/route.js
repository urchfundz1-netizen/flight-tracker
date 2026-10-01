import { NextResponse } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-guard";
import { getFlightById, shiftFlightTimes } from "@/lib/flights";

/**
 * Moves every timestamp on a flight by a number of minutes.
 * POST { minutes: 45 } delays it, { minutes: -30 } pulls it forward.
 */
export async function POST(request, { params }) {
  return withAdmin(request, async () => {
    const { id } = await params;
    if (!(await getFlightById(id))) {
      return NextResponse.json({ error: "Flight not found." }, { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await shiftFlightTimes(id, body.minutes);
    if (!result.ok) return badRequest(result.errors);

    return NextResponse.json({ ok: true, id: result.id });
  });
}
