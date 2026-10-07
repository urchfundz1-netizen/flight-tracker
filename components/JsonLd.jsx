export default function JsonLd() {
  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || "https://flight-tracker.vercel.app";

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Flight Tracker",
    url: SITE_URL,
    description:
      "Free flight tracker to check real-time flight status by booking code (PNR).",
    inLanguage: "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Flight Tracker",
    url: SITE_URL,
    applicationCategory: "TravelApplication",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript",
    description:
      "Check flight status by booking code (PNR). View airline, route, departure/arrival, terminal, gate, boarding time, travel class and flight duration.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Track flights by booking code (PNR)",
      "Real-time flight status",
      "Departure and arrival details",
      "Terminal, gate and boarding information",
      "Flight duration and travel class",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify([website, webApp]),
      }}
    />
  );
}
