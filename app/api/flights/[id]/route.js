import { NextResponse } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-guard";
import { durationMinutes, getFlightById, updateFlight, validateFlight } from "@/lib/flights";

export async function GET(request, { params }) {
  return withAdmin(request, async () => {
    const { id } = await params;
    const flight = await getFlightById(id);
    if (!flight) return NextResponse.json({ error: "Flight not found." }, { status: 404 });

    return NextResponse.json({ flight: { ...flight, duration_minutes: durationMinutes(flight) } });
  });
}

export async function PUT(request, { params }) {
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

    const { data, errors, ok } = validateFlight(body);
    if (!ok) return badRequest(errors);

    const result = await updateFlight(id, data);
    if (!result.ok) return badRequest(result.errors);

    return NextResponse.json({ ok: true, id: result.id, flight: data });
  });
}
