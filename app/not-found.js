import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <div className="container" style={{ maxWidth: 620, textAlign: "center", paddingTop: "2rem" }}>
          <div className="card card--pad-lg stack">
            <h1 style={{ marginBottom: 0 }}>Flight not found</h1>
            <p className="muted" style={{ margin: 0 }}>
              We could not find a flight matching that tracking code. Check the code on your
              booking and try again.
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link href="/" className="btn">
                Track a flight
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
