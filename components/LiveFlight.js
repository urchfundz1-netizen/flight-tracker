import Link from "next/link";
import { formatDuration, formatShortDate, formatTime } from "@/lib/format";
import EmergencyNotice from "./EmergencyNotice";
import styles from "./LiveFlight.module.css";

const STATUS_LABELS = {
  scheduled: "Scheduled",
  boarding: "Boarding",
  departed: "Departed",
  delayed: "Delayed",
  landed: "Landed",
  cancelled: "Cancelled",
  emergency: "Emergency landing",
};

/**
 * Planefinder-style live flight view. Shown right after a tracking code is
 * entered. A "See ticket" action opens the boarding-pass design, which in turn
 * links back here with "See flight".
 */
export default function LiveFlight({ flight, progress = 0, ticketHref }) {
  const flightNumber = flight.flight_number || flight.code;
  const airline = flight.airline;
  const travelClass = flight.travel_class;
  const statusLabel = STATUS_LABELS[flight.status] ?? flight.status;
  const minutes = flight.duration_minutes ?? null;
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  const originCity = flight.origin_city || flight.origin;
  const destinationCity = flight.destination_city || flight.destination;
  const flying = flight.status === "departed";

  return (
    <main className={styles.root}>
      <div className={styles.device}>
        <div className={styles.screen}>
          <div className={styles.app} data-flying={flying}>
            <div className={styles.sky} />
            <div className={styles.land} />
            <div className={styles.fields} />
            <svg
              className={styles.roads}
              viewBox="0 0 400 400"
              preserveAspectRatio="none"
              fill="none"
              stroke="#e8f0c8"
              strokeWidth="1"
            >
              <path d="M-10 120 C120 90 220 150 410 60" />
              <path d="M60 400 C110 300 170 220 260 100" />
              <path d="M-10 260 C100 240 220 300 410 250" strokeOpacity=".6" />
              <path d="M300 400 C320 300 360 260 410 200" strokeOpacity=".6" />
            </svg>
            <div className={styles.haze} />

            <div className={styles.notch}>
              <i />
            </div>

            <div className={styles.brand}>
              <span className={styles.mark}>
                <svg viewBox="0 0 24 24" fill="#fff">
                  <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
                </svg>
              </span>
              <b>Plane</b>
              <span>Tracker</span>
            </div>

            <div className={styles.trail} />
            <div
              className={styles.plane}
              aria-label={`${airline} ${flightNumber} flying from ${originCity} to ${destinationCity}`}
            >
              <svg viewBox="0 0 160 70" fill="none">
                <path
                  d="M80 30 L4 44 Q1 45 3 47 L10 49 L80 40 L150 49 L157 47 Q159 45 156 44 Z"
                  fill="#c9d1d8"
                />
                <path d="M80 30 L4 44 L10 49 L80 38Z" fill="#eef2f5" />
                <path d="M80 30 L156 44 L150 49 L80 38Z" fill="#aab4bd" />
                <ellipse cx="42" cy="44" rx="4.5" ry="3" fill="#8e99a3" />
                <ellipse cx="118" cy="44" rx="4.5" ry="3" fill="#8e99a3" />
                <path d="M66 52 L80 48 L94 52 L94 56 L80 53 L66 56Z" fill="#dfe5ea" />
                <path
                  d="M80 14 C84 14 86 24 86 40 L85 58 L80 64 L75 58 L74 40 C74 24 76 14 80 14Z"
                  fill="#f3f6f8"
                />
                <path d="M80 14 C84 14 86 24 86 40 L85 58 L80 64 Z" fill="#cfd7de" />
                <path d="M80 6 L83 26 L83 40 L80 40 L77 40 L77 26Z" fill="#d23a35" />
                <path d="M80 6 L83 26 L83 40 L80 40Z" fill="#a82a27" />
                <path d="M78 22 h4 v14 h-4z" fill="#1f4f9a" opacity=".85" />
                <ellipse cx="80" cy="20" rx="2.2" ry="3.5" fill="#2b3340" />
              </svg>
            </div>

            <section className={styles.dock}>
              <article className={styles.card}>
                <div className={styles.handle} />
                {flight.status === "emergency" && (
                  <div className={styles.notice} role="alert">
                    <EmergencyNotice
                      flight={flight}
                      titleClassName={styles.noticeTitle}
                      bodyClassName={styles.noticeBody}
                      paraClassName={styles.noticePara}
                      signatureClassName={styles.noticeSignature}
                    />
                  </div>
                )}
                <div className={styles.head}>
                  <svg
                    className={styles.airline}
                    viewBox="0 0 32 32"
                    aria-hidden="true"
                  >
                    <path d="M5 8 L24 24 L19 24 L3 11 Z" fill="#9aa4ae" />
                    <path d="M12 6 L28 21 L24 22 L9 9 Z" fill="#c8312f" />
                    <path d="M15 3 L28 13 L26 18 Z" fill="#1b5fa8" opacity=".9" />
                  </svg>
                  <div className={styles.info}>
                    <div className={styles.l1}>
                      <span className={styles.flight}>{flightNumber}</span>
                      <span className={styles.tag}>{flight.code}</span>
                      <span className={styles.tag}>{travelClass}</span>
                    </div>
                    <div className={styles.l2}>
                      {travelClass} · {airline}
                    </div>
                    <div className={styles.l3}>
                      {statusLabel} · {formatShortDate(flight.boarding_date)}
                    </div>
                  </div>
                  <div className={styles.thumb}>
                    <svg
                      viewBox="0 0 92 55"
                      preserveAspectRatio="xMidYMid slice"
                    >
                      <defs>
                        <linearGradient id="lf-sky" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#6fa6e6" />
                          <stop offset="1" stopColor="#cfe3f5" />
                        </linearGradient>
                      </defs>
                      <rect width="92" height="55" fill="url(#lf-sky)" />
                      <rect x="0" y="44" width="92" height="11" fill="#43576b" />
                      <rect x="54" y="36" width="8" height="12" fill="#6e7f90" />
                      <rect x="64" y="40" width="10" height="9" fill="#8896a4" />
                      <rect x="76" y="34" width="7" height="14" fill="#5b6c7d" />
                      <rect x="12" y="42" width="14" height="6" fill="#7b8a98" />
                      <path
                        d="M16 26 L58 20 L72 17 L76 18 L60 24 L54 27 Z"
                        fill="#f3f5f7"
                      />
                      <path d="M52 22 L44 12 L48 12 L60 21Z" fill="#e9edf0" />
                      <path d="M72 17 L74 11 L76 11 L76 18Z" fill="#d23a35" />
                      <path d="M34 25 L22 33 L28 33 L44 24Z" fill="#cfd6dc" />
                    </svg>
                  </div>
                </div>

                <div className={styles.route}>
                  <span className={styles.city}>{originCity}</span>
                  <span />
                  <span className={`${styles.city} ${styles.r}`}>
                    {destinationCity}
                  </span>
                  <b className={styles.code}>{flight.origin}</b>
                  <div
                    className={styles.bar}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <b className={`${styles.code} ${styles.r}`}>
                    {flight.destination}
                  </b>
                  <span className={styles.sub}>
                    {formatTime(flight.departure_time)} ·{" "}
                    {formatShortDate(flight.boarding_date)}
                  </span>
                  <span />
                  <span className={`${styles.sub} ${styles.r}`}>
                    {formatTime(flight.arrival_time)} ·{" "}
                    {formatShortDate(flight.arrival_date)}
                  </span>
                </div>

                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 12l3.5-4" />
                    </svg>
                    {formatDuration(minutes)}
                  </div>
                  <div className={styles.stat}>
                    <svg viewBox="0 0 24 24">
                      <path d="M4 21h16M6 21V8l6-4 6 4v13M10 21v-5h4v5" />
                    </svg>
                    {flight.terminal || "—"}
                  </div>
                  <div className={styles.stat}>
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    {flight.gate || "—"}
                  </div>
                </div>

                <Link href={ticketHref} className={styles.ticketBtn}>
                  <svg viewBox="0 0 24 24">
                    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
                    <path d="M12 6v12" />
                  </svg>
                  See ticket
                </Link>
              </article>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
