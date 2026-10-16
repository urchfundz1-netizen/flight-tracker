"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const SHIFT_PRESETS = [15, 30, 60, 120];

const STATUS_LABELS = {
  scheduled: "Scheduled",
  boarding: "Boarding",
  departed: "Departed",
  delayed: "Delayed",
  landed: "Landed",
  cancelled: "Cancelled",
  emergency: "Emergency landing",
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS);

export default function FlightTable({ flights }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const [shiftFor, setShiftFor] = useState(null);
  const [shiftValue, setShiftValue] = useState("30");
  const [emergencyFor, setEmergencyFor] = useState(null);
  const [emergencyAirport, setEmergencyAirport] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return flights.filter((flight) => {
      if (status && flight.status !== status) return false;
      if (!term) return true;
      return [
        flight.code,
        flight.airline,
        flight.origin,
        flight.origin_city,
        flight.destination,
        flight.destination_city,
        flight.passenger_name,
      ]
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

  async function changeStatus(flight, nextStatus) {
    if (nextStatus === flight.status) return;
    setBusyId(flight.id);
    setMessage(null);
    try {
      await post(`/api/flights/${flight.id}/status`, { status: nextStatus });
      const label =
        nextStatus === "auto" ? "automatic" : STATUS_LABELS[nextStatus] ?? nextStatus;
      setMessage({ kind: "ok", text: `Flight ${flight.code} set to ${label}.` });
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

  // Selecting "Emergency landing" asks for the airport first, then pins the
  // status with it in one call.
  async function applyEmergency(flight) {
    setBusyId(flight.id);
    setMessage(null);
    try {
      await post(`/api/flights/${flight.id}/status`, {
        status: "emergency",
        emergency_airport: emergencyAirport.trim(),
      });
      setMessage({ kind: "ok", text: `Flight ${flight.code} set to Emergency landing.` });
      setEmergencyFor(null);
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
            <option value="emergency">Emergency landing</option>
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
                      {(flight.origin_city || flight.destination_city) && (
                        <div className="small muted">
                          {[flight.origin_city, flight.destination_city]
                            .filter(Boolean)
                            .join(" → ")}
                        </div>
                      )}
                    </td>
                    <td data-label="Boarding">
                      <div>{flight.boarding_date}</div>
                      <div className="small muted">
                        {flight.boarding_time} · T{flight.terminal || "?"}
                      </div>
                    </td>
                    <td data-label="Status">
                      <StatusPill status={flight.status} />
                      {flight.status_locked && (
                        <div className="small muted" style={{ marginTop: "0.2rem" }}>
                          Manual
                        </div>
                      )}
                      <select
                        className="select"
                        style={{ marginTop: "0.35rem", minHeight: 34, fontSize: "0.82rem" }}
                        value={flight.status}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (next === "emergency") {
                            setEmergencyFor(flight.id);
                            setEmergencyAirport(flight.emergency_airport || "");
                            return;
                          }
                          changeStatus(flight, next);
                        }}
                        disabled={busyId === flight.id}
                        aria-label={`Change status for ${flight.code}`}
                      >
                        {STATUS_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                        <option value="auto">Auto (by time)</option>
                      </select>
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

      {emergencyFor && (
        <EmergencyDialog
          flight={visible.find((flight) => flight.id === emergencyFor)}
          value={emergencyAirport}
          onValueChange={setEmergencyAirport}
          onCancel={() => setEmergencyFor(null)}
          onSubmit={() => applyEmergency(visible.find((flight) => flight.id === emergencyFor))}
          busy={busyId === emergencyFor}
        />
      )}
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`badge badge--${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
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

function EmergencyDialog({ flight, value, onValueChange, onCancel, onSubmit, busy }) {
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
      aria-label={`Set flight ${flight.code} to emergency landing`}
    >
      <div className="card card--pad-lg" style={{ width: "100%", maxWidth: 460 }}>
        <h2 style={{ fontSize: "1.15rem" }}>Emergency landing — {flight.code}</h2>
        <p className="muted small">
          This flight will show a NOTICE to passengers. Name the airport where it landed.
        </p>

        <div className="field">
          <label className="label" htmlFor="emergency-airport">
            Emergency landing airport
          </label>
          <input
            id="emergency-airport"
            className="input"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="e.g. Chicago O'Hare"
            maxLength={120}
            autoFocus
          />
          <div className="hint" style={{ marginTop: "0.4rem" }}>
            Appears in the NOTICE on the customer&apos;s ticket and live page. If left blank, the
            destination is used.
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--danger" onClick={onSubmit} disabled={busy}>
            {busy ? "Setting…" : "Set emergency landing"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
