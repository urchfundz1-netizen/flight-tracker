import Link from "next/link";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { durationMinutes } from "@/lib/flights";
import StatusBadge from "./StatusBadge";

/**
 * Read-only flight card shown to passengers after they enter a tracking code.
 */
export default function FlightDetails({ flight, backHref = "/" }) {
  const minutes = flight.duration_minutes ?? durationMinutes(flight);
  const cancelled = flight.status === "cancelled";

  return (
    <div className="stack">
      <div className="card card--pad-lg stack">
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

        <div className="route">
          <div className="route__end">
            <div className="route__code">{flight.origin}</div>
            <div className="small muted">From</div>
          </div>
          <div className="route__line">
            <span>{formatDuration(minutes)}</span>
            <span aria-hidden="true">─────✈─────</span>
            <span>{flight.flight_number ?? "Flight"}</span>
          </div>
          <div className="route__end">
            <div className="route__code">{flight.destination}</div>
            <div className="small muted">To</div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail">
            <div className="detail__label">Airline</div>
            <div className="detail__value">{flight.airline}</div>
          </div>
          <div className="detail">
            <div className="detail__label">Travel class</div>
            <div className="detail__value">{flight.travel_class}</div>
          </div>
          <div className="detail">
            <div className="detail__label">Flight duration</div>
            <div className="detail__value">{formatDuration(minutes)}</div>
          </div>
          <div className="detail">
            <div className="detail__label">Terminal</div>
            <div className="detail__value">{flight.terminal || "—"}</div>
          </div>
          <div className="detail">
            <div className="detail__label">Gate</div>
            <div className="detail__value">{flight.gate || "—"}</div>
          </div>
          <div className="detail">
            <div className="detail__label">Seat</div>
            <div className="detail__value">{flight.seat || "—"}</div>
          </div>
          <div className="detail">
            <div className="detail__label">Passenger</div>
            <div className="detail__value">{flight.passenger_name || "—"}</div>
          </div>
          <div className="detail">
            <div className="detail__label">Boarding date</div>
            <div className="detail__value">{formatDate(flight.boarding_date)}</div>
          </div>
        </div>
      </div>

      <div className="card card--pad-lg">
        <h2>Schedule</h2>
        <div className="timeline">
          <div className="timeline__row">
            <div className="timeline__time">{formatTime(flight.boarding_time)}</div>
            <div className="timeline__body">
              <div className="timeline__title">Boarding begins</div>
              <div className="timeline__meta">
                Terminal {flight.terminal || "TBC"} · Gate {flight.gate || "TBC"} ·{" "}
                {formatDate(flight.boarding_date)}
              </div>
            </div>
          </div>
          <div className="timeline__row">
            <div className="timeline__time">{formatTime(flight.departure_time)}</div>
            <div className="timeline__body">
              <div className="timeline__title">Departure from {flight.origin}</div>
              <div className="timeline__meta">{flight.airline}</div>
            </div>
          </div>
          <div className="timeline__row">
            <div className="timeline__time">{formatTime(flight.arrival_time)}</div>
            <div className="timeline__body">
              <div className="timeline__title">Arrival at {flight.destination}</div>
              <div className="timeline__meta">{formatDate(flight.arrival_date)}</div>
            </div>
          </div>
        </div>
      </div>

      {flight.note && (
        <div className="alert alert--info">Note from the airline: {flight.note}</div>
      )}

      <div className="row">
        <Link href={backHref} className="btn btn--ghost btn--sm">
          Track another flight
        </Link>
      </div>
    </div>
  );
}
