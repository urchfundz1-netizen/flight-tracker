"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const SHIFT_PRESETS = [15, 30, 60, 120];

export default function FlightTable({ flights }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const [shiftFor, setShiftFor] = useState(null);
  const [shiftValue, setShiftValue] = useState("30");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return flights.filter((flight) => {
      if (status && flight.status !== status) return false;
      if (!term) return true;
      return [flight.code, flight.airline, flight.origin, flight.destination, flight.passenger_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [flights, query, status]);

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "That action failed.");
    return data;
  }

  async function cancelFlight(flight) {
    const restoring = flight.status === "cancelled";
    const verb = restoring ? "reinstate" : "cancel";
    if (!window.confirm(`${restoring ? "Reinstate" : "Cancel"} flight ${flight.code}?`)) return;

    setBusyId(flight.id);
    setMessage(null);
    try {
      await post(`/api/flights/${flight.id}/status`, { status: restoring ? "scheduled" : "cancelled" });
      setMessage({ kind: "ok", text: `Flight ${flight.code} ${restoring ? "reinstated" : "cancelled"}.` });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function applyShift(flight) {
    const minutes = Number(shiftValue);
    setBusyId(flight.id);
    setMessage(null);
    try {
      await post(`/api/flights/${flight.id}/shift`, { minutes });
      const sign = minutes > 0 ? "+" : "";
      setMessage({ kind: "ok", text: `Flight ${flight.code} shifted by ${sign}${minutes} minutes.` });
      setShiftFor(null);
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <div className="filters">
        <div className="field">
          <label className="label" htmlFor="search">
            Search
          </label>
          <input
            id="search"
            className="input"
            placeholder="Code, airline, city, passenger…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="status-filter">
            Status
          </label>
          <select
            id="status-filter"
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="boarding">Boarding</option>
            <option value="departed">Departed</option>
            <option value="delayed">Delayed</option>
            <option value="landed">Landed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <Link className="btn" href="/admin/flights/new">
          Add flight
        </Link>
      </div>

      {message && (
        <p
          className={`alert alert--${message.kind === "ok" ? "ok" : "error"}`}
          style={{ margin: 0 }}
          role="status"
        >
          {message.text}
        </p>
      )}

      <div className="card" style={{ padding: "0.4rem" }}>
        {visible.length === 0 ? (
          <p className="muted" style={{ margin: 0, padding: "1.5rem 1rem", textAlign: "center" }}>
            {flights.length === 0 ? "No flights yet. Add your first one." : "No flights match your search."}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table table--responsive">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Route</th>
                  <th>Boarding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((flight) => (
                  <tr key={flight.id}>
                    <td data-label="Code">
                      <div className="mono" style={{ fontWeight: 700 }}>
                        {flight.code}
                      </div>
                      <div className="small muted">{flight.travel_class}</div>
                    </td>
                    <td data-label="Route">
                      <div style={{ fontWeight: 600 }}>
                        {flight.origin} → {flight.destination}
                      </div>
                      <div className="small muted">{flight.airline}</div>
                    </td>
                    <td data-label="Boarding">
                      <div>{flight.boarding_date}</div>
                      <div className="small muted">
                        {flight.boarding_time} · T{flight.terminal || "?"}
                      </div>
                    </td>
                    <td data-label="Status">
                      <StatusPill status={flight.status} />
                    </td>
                    <td data-label="">
                      <div className="table__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setShiftFor(shiftFor === flight.id ? null : flight.id);
                            setShiftValue("30");
                          }}
                          disabled={busyId === flight.id || flight.status === "cancelled"}
                        >
                          Shift
                        </button>
                        <button
                          type="button"
                          className={`btn btn--sm ${flight.status === "cancelled" ? "btn--success" : "btn--danger"}`}
                          onClick={() => cancelFlight(flight)}
                          disabled={busyId === flight.id}
                        >
                          {flight.status === "cancelled" ? "Reinstate" : "Cancel"}
                        </button>
                        <Link className="btn btn--ghost btn--sm" href={`/admin/flights/${flight.id}`}>
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shiftFor && (
        <ShiftDialog
          flight={visible.find((flight) => flight.id === shiftFor)}
          value={shiftValue}
          onValueChange={setShiftValue}
          onCancel={() => setShiftFor(null)}
          onSubmit={() => applyShift(visible.find((flight) => flight.id === shiftFor))}
          busy={busyId === shiftFor}
        />
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const labels = {
    scheduled: "Scheduled",
    boarding: "Boarding",
    departed: "Departed",
    delayed: "Delayed",
    landed: "Landed",
    cancelled: "Cancelled",
  };
  return <span className={`badge badge--${status}`}>{labels[status] ?? status}</span>;
}

function ShiftDialog({ flight, value, onValueChange, onCancel, onSubmit, busy }) {
  if (!flight) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 9, 20, 0.72)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
        zIndex: 50,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Shift flight ${flight.code}`}
    >
      <div className="card card--pad-lg" style={{ width: "100%", maxWidth: 420 }}>
        <h2 style={{ fontSize: "1.15rem" }}>Shift flight {flight.code}</h2>
        <p className="muted small">
          Boarding {flight.boarding_date} {flight.boarding_time} · Departs {flight.departure_time} · Arrives{" "}
          {flight.arrival_time}
        </p>

        <div className="field">
          <label className="label" htmlFor="shift-minutes">
            Shift by (minutes)
          </label>
          <input
            id="shift-minutes"
            className="input"
            type="number"
            step="5"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            autoFocus
          />
          <div className="row" style={{ marginTop: "0.4rem" }}>
            {SHIFT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => onValueChange(String(preset))}
              >
                +{preset}
              </button>
            ))}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onValueChange(String(-Number(SHIFT_PRESETS[0])))}
            >
              -15
            </button>
          </div>
          <div className="hint" style={{ marginTop: "0.4rem" }}>
            Positive delays the flight, negative brings it forward. Boarding, departure and arrival
            all move together.
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onSubmit} disabled={busy}>
            {busy ? "Applying…" : "Apply shift"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
