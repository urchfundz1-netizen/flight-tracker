import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import FlightDetails from "@/components/FlightDetails";
import { durationMinutes, findFlightByCode } from "@/lib/flights";

export async function generateMetadata({ params }) {
  const { code } = await params;
  return { title: `Flight ${String(code).toUpperCase()}` };
}

export default async function TrackPage({ params }) {
  const { code } = await params;
  const flight = await findFlightByCode(code);

  if (!flight) notFound();

  return (
    <>
      <SiteHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 780 }}>
          <FlightDetails flight={{ ...flight, duration_minutes: durationMinutes(flight) }} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
