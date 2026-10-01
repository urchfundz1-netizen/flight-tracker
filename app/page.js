import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function HomePage() {
  async function track(formData) {
    "use server";
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    if (!code) redirect("/?error=empty#track");
    redirect(`/track/${encodeURIComponent(code)}`);
  }

  return (
    <>
      <SiteHeader />
      <main>
        <div className="container">
          <section className="hero" id="track">
            <h1>Track your flight</h1>
            <p>
              Enter the tracking code from your booking to see the airline, travel class,
              terminal, boarding date and time, and how long the flight takes.
            </p>

            <form action={track} className="track-form">
              <label htmlFor="code" className="sr-only" style={{ position: "absolute", left: "-9999px" }}>
                Tracking code
              </label>
              <input
                id="code"
                name="code"
                className="input"
                placeholder="e.g. AB1234"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                maxLength={8}
                required
              />
              <button type="submit" className="btn">
                Track
              </button>
            </form>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
