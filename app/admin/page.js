import requireAdminPage from "@/lib/require-admin-page";
import { flightStats, listFlights } from "@/lib/flights";
import { AdminFooter, AdminHeader } from "@/components/AdminChrome";
import FlightTable from "@/components/FlightTable";

export const metadata = { title: "Flights" };
export const dynamic = "force-dynamic";

export default async function AdminFlightsPage() {
  const admin = await requireAdminPage();
  const flights = await listFlights();
  const stats = await flightStats();

  return (
    <>
      <AdminHeader username={admin.username} />
      <main className="page">
        <div className="container">
          <div className="section-head">
            <div>
              <h1 style={{ fontSize: "1.7rem", marginBottom: "0.2rem" }}>Flights</h1>
              <p className="muted small" style={{ margin: 0 }}>
                Add flights, shift schedules, or cancel a flight.
              </p>
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat__value">{stats.total}</div>
              <div className="stat__label">Total flights</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.active}</div>
              <div className="stat__label">Active</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.cancelled}</div>
              <div className="stat__label">Cancelled</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.today}</div>
              <div className="stat__label">Boarding today</div>
            </div>
          </div>

          <FlightTable flights={flights} />
        </div>
      </main>
      <AdminFooter />
    </>
  );
}
