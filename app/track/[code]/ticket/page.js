import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import FlightDetails from "@/components/FlightDetails";
import { durationMinutes, findFlightByCode } from "@/lib/flights";

export async function generateMetadata({ params }) {
  const { code } = await params;
  return { title: `Ticket ${String(code).toUpperCase()}` };
}

export default async function TicketPage({ params }) {
  const { code } = await params;
  const flight = await findFlightByCode(code);

  if (!flight) notFound();

  const encoded = encodeURIComponent(flight.code);

  return (
    <>
      <SiteHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 1050 }}>
          <FlightDetails
            flight={{ ...flight, duration_minutes: durationMinutes(flight) }}
            liveHref={`/track/${encoded}`}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
