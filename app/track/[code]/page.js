import { notFound } from "next/navigation";
import LiveFlight from "@/components/LiveFlight";
import { durationMinutes, findFlightByCode, flightProgress } from "@/lib/flights";

export async function generateMetadata({ params }) {
  const { code } = await params;
  const flight = await findFlightByCode(code);
  const label = flight?.flight_number || String(code).toUpperCase();
  return { title: `Flight ${label}` };
}

export default async function TrackPage({ params }) {
  const { code } = await params;
  const flight = await findFlightByCode(code);

  if (!flight) notFound();

  const encoded = encodeURIComponent(flight.code);

  return (
    <LiveFlight
      flight={{ ...flight, duration_minutes: durationMinutes(flight) }}
      progress={flightProgress(flight)}
      ticketHref={`/track/${encoded}/ticket`}
    />
  );
}
