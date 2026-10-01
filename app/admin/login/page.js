import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="login-shell">
        <div className="login-card">
          <div className="login-head">
            <div className="login-head__mark" aria-hidden="true">
              🔐
            </div>
            <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Admin sign in</h1>
            <p className="muted small" style={{ margin: 0 }}>
              This area is restricted to authorised staff.
            </p>
          </div>

          <div className="card card--pad-lg">
            <LoginForm />
          </div>

          <p className="small muted" style={{ textAlign: "center", marginTop: "1rem" }}>
            Not staff?{" "}
            <Link href="/">Go to flight tracking</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
