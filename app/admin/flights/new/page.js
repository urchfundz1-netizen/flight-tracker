import Link from "next/link";
import { AdminFooter, AdminHeader } from "@/components/AdminChrome";
import FlightForm from "@/components/FlightForm";
import requireAdminPage from "@/lib/require-admin-page";

export const metadata = { title: "Add flight" };

export default async function NewFlightPage() {
  const admin = await requireAdminPage();

  return (
    <>
      <AdminHeader username={admin.username} />
      <main className="page">
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="section-head">
            <div>
              <h1 style={{ fontSize: "1.7rem", marginBottom: "0.2rem" }}>Add a flight</h1>
              <p className="muted small" style={{ margin: 0 }}>
                Passengers look this up with the tracking code.
              </p>
            </div>
            <Link href="/admin" className="btn btn--ghost btn--sm">
              Back to list
            </Link>
          </div>

          <FlightForm mode="create" />
        </div>
      </main>
      <AdminFooter />
    </>
  );
}
