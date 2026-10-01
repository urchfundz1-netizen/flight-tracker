import Link from "next/link";
import { AdminFooter, AdminHeader } from "@/components/AdminChrome";
import PasswordForm from "@/components/PasswordForm";
import requireAdminPage from "@/lib/require-admin-page";

export const metadata = { title: "Change password" };

export default async function AdminAccountPage() {
  const admin = await requireAdminPage();

  return (
    <>
      <AdminHeader username={admin.username} />
      <main className="page">
        <div className="container" style={{ maxWidth: 560 }}>
          <div className="section-head">
            <div>
              <h1 style={{ fontSize: "1.7rem", marginBottom: "0.2rem" }}>Change password</h1>
              <p className="muted small" style={{ margin: 0 }}>
                Signed in as {admin.username}.
              </p>
            </div>
            <Link href="/admin" className="btn btn--ghost btn--sm">
              Back
            </Link>
          </div>

          <PasswordForm />
        </div>
      </main>
      <AdminFooter />
    </>
  );
}
