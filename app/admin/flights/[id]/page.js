import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminFooter, AdminHeader } from "@/components/AdminChrome";
import FlightForm from "@/components/FlightForm";
import requireAdminPage from "@/lib/require-admin-page";
import { durationMinutes, getFlightById } from "@/lib/flights";
import { formatDate, formatDuration } from "@/lib/format";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const flight = await getFlightById(id);
  return { title: flight ? `Edit ${flight.code}` : "Edit flight" };
}

export default async function EditFlightPage({ params }) {
  const { id } = await params;
  const admin = await requireAdminPage();
  const flight = await getFlightById(id);

  if (!flight) notFound();

  const minutes = durationMinutes(flight);

  return (
    <>
      <AdminHeader username={admin.username} />
      <main className="page">
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="section-head">
            <div>
              <h1 style={{ fontSize: "1.7rem", marginBottom: "0.2rem" }}>
                Edit <span className="mono">{flight.code}</span>
              </h1>
              <p className="muted small" style={{ margin: 0 }}>
                {flight.origin} → {flight.destination} · Boarding {formatDate(flight.boarding_date)} ·{" "}
                {formatDuration(minutes)} in the air
              </p>
            </div>
            <div className="row">
              <Link href={`/track/${flight.code}`} className="btn btn--ghost btn--sm">
                View public page
              </Link>
              <Link href="/admin" className="btn btn--ghost btn--sm">
                Back to list
              </Link>
            </div>
          </div>

          <FlightForm mode="edit" flight={flight} />
        </div>
      </main>
      <AdminFooter />
    </>
  );
}
