import { NextResponse } from "next/server";
import { durationMinutes, findFlightByCode, normalizeCode } from "@/lib/flights";

export async function GET(_request, { params }) {
  const { code } = await params;
  const normalized = normalizeCode(code);

  if (!normalized) {
    return NextResponse.json({ error: "Enter a tracking code." }, { status: 400 });
  }

  try {
    const flight = await findFlightByCode(normalized);
    if (!flight) {
      return NextResponse.json({ error: `No flight found for "${normalized}".` }, { status: 404 });
    }

    return NextResponse.json({
      flight: { ...flight, duration_minutes: durationMinutes(flight) },
    });
  } catch (error) {
    // This route is public, so a database failure must not surface as a stack
    // trace or a confusing "not found" to someone looking up their flight.
    console.error("[track] lookup failed:", error);
    return NextResponse.json(
      { error: "We could not reach the flight database. Please try again shortly." },
      { status: 503 },
    );
  }
}
