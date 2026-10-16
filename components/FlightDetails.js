import Link from "next/link";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { durationMinutes } from "@/lib/flights";
import EmergencyNotice from "./EmergencyNotice";
import StatusBadge from "./StatusBadge";

/**
 * Read-only boarding-pass style ticket shown to passengers after they enter a
 * tracking code.
 */
export default function FlightDetails({ flight, liveHref }) {
  const minutes = flight.duration_minutes ?? durationMinutes(flight);
  const cancelled = flight.status === "cancelled";
  const airline = flight.airline;

  return (
    <div className="stack">
      {flight.status === "emergency" && (
        <div className="emergency-notice" role="alert">
          <EmergencyNotice
            flight={flight}
            titleClassName="emergency-notice__title"
            bodyClassName="emergency-notice__body"
            paraClassName="emergency-notice__para"
            signatureClassName="emergency-notice__signature"
          />
        </div>
      )}

      <div className="ticket">
        <header className="ticket__header">
          <div className="ticket__header-main">
            <span className="ticket__globe" aria-hidden="true">
              ✈
            </span>
            <h1 className="ticket__title">AIRLINE TICKET</h1>
          </div>
          <div className="ticket__header-stub">
            <h2 className="ticket__subtitle">BOARDING PASS</h2>
          </div>
        </header>

        <div className="ticket__body">
          <section className="ticket__main">
            <div className="ticket__main-inner">
              <div className="ticket__vbarcode" aria-hidden="true" />

              <div className="ticket__details">
                <div className="ticket__route">
                  <div>
                    <p className="ticket__label">From:</p>
                    <h2 className="ticket__airport">{flight.origin}</h2>
                    <p className="ticket__city">{flight.origin_city || flight.origin}</p>
                    <p className="ticket__when">{formatDate(flight.boarding_date)}</p>
                    <p className="ticket__when">{formatTime(flight.departure_time)}</p>
                  </div>

                  <div className="ticket__route-mid">
                    <span className="ticket__route-line" />
                    <span className="ticket__plane" aria-hidden="true">
                      ✈
                    </span>
                    <span className="ticket__route-line" />
                  </div>

                  <div>
                    <p className="ticket__label">To:</p>
                    <h2 className="ticket__airport">{flight.destination}</h2>
                    <p className="ticket__city">{flight.destination_city || flight.destination}</p>
                    <p className="ticket__when">{formatDate(flight.arrival_date)}</p>
                    <p className="ticket__when">{formatTime(flight.arrival_time)}</p>
                  </div>
                </div>

                <div className="ticket__grid">
                  <div className="ticket__cell ticket__cell--wide">
                    <p className="ticket__label">Passenger Name</p>
                    <p className="ticket__value">{flight.passenger_name || "—"}</p>
                  </div>
                  <div className="ticket__cell">
                    <p className="ticket__label">Flight:</p>
                    <p className="ticket__value">{flight.flight_number || "—"}</p>
                  </div>
                  <div className="ticket__cell">
                    <p className="ticket__label">Seat:</p>
                    <p className="ticket__value">{flight.seat || "—"}</p>
                  </div>
                  <div className="ticket__cell">
                    <p className="ticket__label">Airline:</p>
                    <p className="ticket__value">{airline}</p>
                  </div>
                  <div className="ticket__cell">
                    <p className="ticket__label">Gate:</p>
                    <p className="ticket__value">{flight.gate || "—"}</p>
                  </div>
                  <div className="ticket__cell">
                    <p className="ticket__label">Terminal:</p>
                    <p className="ticket__value">{flight.terminal || "—"}</p>
                  </div>
                  <div className="ticket__cell">
                    <p className="ticket__label">Class:</p>
                    <p className="ticket__value">{flight.travel_class}</p>
                  </div>
                </div>

                <p className="ticket__notice">
                  GATE CLOSES 20 MINUTES BEFORE DEPARTURE
                </p>
              </div>
            </div>
          </section>

          <aside className="ticket__stub">
            <div className="ticket__stub-inner">
              <div className="ticket__stub-route">
                <div>
                  <p className="ticket__stub-label">From:</p>
                  <h3 className="ticket__stub-code">{flight.origin}</h3>
                  <p className="ticket__stub-city">{flight.origin_city || flight.origin}</p>
                  <p className="ticket__stub-when">{formatDate(flight.boarding_date)}</p>
                  <p className="ticket__stub-when">{formatTime(flight.departure_time)}</p>
                </div>

                <span className="ticket__stub-plane" aria-hidden="true">
                  ✈
                </span>

                <div>
                  <p className="ticket__stub-label">To:</p>
                  <h3 className="ticket__stub-code">{flight.destination}</h3>
                  <p className="ticket__stub-city">{flight.destination_city || flight.destination}</p>
                  <p className="ticket__stub-when">{formatDate(flight.arrival_date)}</p>
                  <p className="ticket__stub-when">{formatTime(flight.arrival_time)}</p>
                </div>
              </div>

              <div className="ticket__stub-grid">
                <div className="ticket__stub-cell ticket__stub-cell--wide">
                  <p className="ticket__stub-label">Passenger Name</p>
                  <p className="ticket__stub-value">{flight.passenger_name || "—"}</p>
                </div>
                <div className="ticket__stub-cell">
                  <p className="ticket__stub-label">Flight:</p>
                  <p className="ticket__stub-value">{flight.flight_number || "—"}</p>
                </div>
                <div className="ticket__stub-cell">
                  <p className="ticket__stub-label">Seat:</p>
                  <p className="ticket__stub-value">{flight.seat || "—"}</p>
                </div>
                <div className="ticket__stub-cell">
                  <p className="ticket__stub-label">Gate:</p>
                  <p className="ticket__stub-value">{flight.gate || "—"}</p>
                </div>
                <div className="ticket__stub-cell">
                  <p className="ticket__stub-label">Terminal:</p>
                  <p className="ticket__stub-value">{flight.terminal || "—"}</p>
                </div>
                <div className="ticket__stub-cell">
                  <p className="ticket__stub-label">Class:</p>
                  <p className="ticket__stub-value">{flight.travel_class}</p>
                </div>
              </div>

              <div className="ticket__barcode" aria-hidden="true" />
            </div>
          </aside>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="detail__label">Tracking code</div>
          <div className="detail__value detail__value--lg mono">{flight.code}</div>
        </div>
        <StatusBadge status={flight.status} />
      </div>

      {cancelled && (
        <p className="alert alert--error" style={{ margin: 0 }}>
          This flight has been cancelled. Contact your airline for rebooking options.
        </p>
      )}

      <p className="muted small" style={{ margin: 0 }}>
        Flight duration {formatDuration(minutes)} · Departure{" "}
        {formatTime(flight.departure_time)} · Arrival {formatTime(flight.arrival_time)}
      </p>

      {flight.note && (
        <div className="alert alert--info">Note from the airline: {flight.note}</div>
      )}

      <div className="row">
        {liveHref && (
          <Link href={liveHref} className="btn">
            See flight
          </Link>
        )}
      </div>
    </div>
  );
}
