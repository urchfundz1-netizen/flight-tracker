import { NextResponse } from "next/server";
import { badRequest, withAdmin } from "@/lib/api-guard";
import { createFlight, listFlights, validateFlight, durationMinutes } from "@/lib/flights";

export async function GET(request) {
  return withAdmin(request, async () => {
    const params = request.nextUrl.searchParams;
    const flights = await listFlights({
      search: params.get("search") ?? "",
      status: params.get("status") ?? "",
    });

    return NextResponse.json({
      flights: flights.map((flight) => ({ ...flight, duration_minutes: durationMinutes(flight) })),
    });
  });
}

export async function POST(request) {
  return withAdmin(request, async () => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { data, errors, ok } = validateFlight(body);
    if (!ok) return badRequest(errors);

    const result = await createFlight(data);
    if (!result.ok) return badRequest(result.errors);

    return NextResponse.json({ ok: true, id: result.id, flight: data }, { status: 201 });
  });
}
