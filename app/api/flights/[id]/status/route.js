import { NextResponse } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-guard";
import { getFlightById, setFlightStatus } from "@/lib/flights";

/**
 * Cancels or reinstates a flight.
 * POST { status: "cancelled" } or { status: "scheduled" } to restore it.
 */
export async function POST(request, { params }) {
  return withAdmin(request, async () => {
    const { id } = await params;
    const flight = await getFlightById(id);
    if (!flight) return NextResponse.json({ error: "Flight not found." }, { status: 404 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await setFlightStatus(id, body.status);
    if (!result.ok) return badRequest(result.errors);

    return NextResponse.json({ ok: true, status: body.status });
  });
}
