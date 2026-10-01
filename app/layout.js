import "./globals.css";

export const metadata = {
  title: {
    default: "Flight Tracker",
    template: "%s | Flight Tracker",
  },
  description:
    "Track your flight status with your booking code. See the airline, travel class, terminal, boarding date and time, and how long the flight takes.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
