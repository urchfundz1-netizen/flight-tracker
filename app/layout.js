import "./globals.css";
import JsonLd from "@/components/JsonLd";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://flight-tracker.vercel.app";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Flight Tracker – Track Flights by Booking Code (PNR)",
    template: "%s | Flight Tracker",
  },
  description:
    "Free flight tracker to check real-time flight status by booking code (PNR). View airline, departure/arrival, terminal, gate, boarding time, travel class, and flight duration.",
  applicationName: "Flight Tracker",
  keywords: [
    "flight tracker",
    "flight status",
    "track flight",
    "flight tracking",
    "PNR tracker",
    "booking code tracker",
    "flight status by PNR",
    "flight status by booking reference",
    "airline flight status",
    "real-time flight tracker",
  ],
  authors: [{ name: "Flight Tracker" }],
  creator: "Flight Tracker",
  publisher: "Flight Tracker",
  category: "Travel",
  classification: "Travel & Transportation",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Flight Tracker",
    title: "Flight Tracker – Track Flights by Booking Code (PNR)",
    description:
      "Check real-time flight status by booking code (PNR). See airline, route, departure/arrival times, terminal, gate, boarding, and flight duration.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Flight Tracker – Track flights by booking code",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flight Tracker – Track Flights by Booking Code (PNR)",
    description:
      "Free flight tracker to check real-time flight status by booking reference (PNR). View route, times, terminal, gate & boarding info.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "jSzCRW3dc6kLYq9WfBpDAgZWHfY-mySRPfIsGpfNRbY",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <JsonLd />
      </head>
      <body>{children}</body>
    </html>
  );
}
