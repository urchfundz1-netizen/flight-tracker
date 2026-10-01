"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const EMPTY = {
  code: "",
  airline: "",
  flight_number: "",
  origin: "",
  destination: "",
  travel_class: "Economy",
  terminal: "",
  gate: "",
  seat: "",
  passenger_name: "",
  boarding_date: "",
  boarding_time: "",
  departure_time: "",
  arrival_date: "",
  arrival_time: "",
  status: "scheduled",
  note: "",
};

export default function FlightForm({ flight, mode = "create" }) {
  const router = useRouter();
  const [values, setValues] = useState(flight ?? EMPTY);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [pending, setPending] = useState(false);

  const isEdit = mode === "edit";

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  /** Keeps the arrival date in step with the boarding date while the user is editing. */
  function setBoardingDate(name, value) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (!isEdit && value && (!prev.arrival_date || prev.arrival_date < value)) {
        next.arrival_date = value;
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setBanner("");

    try {
      const url = isEdit ? `/api/flights/${flight.id}` : "/api/flights";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrors(data.errors || {});
        setBanner(data.error || "Could not save the flight.");
        setPending(false);
        return;
      }

      router.push(`/admin?${data.id ? `saved=${data.id}` : ""}`);
      router.refresh();
    } catch {
      setBanner("Network error. Try again.");
      setPending(false);
    }
  }

  const backHref = isEdit ? `/admin/flights/${flight.id}` : "/admin";

  return (
    <form className="stack" onSubmit={onSubmit}>
      {banner && (
        <p className="alert alert--error" style={{ margin: 0 }} role="alert">
          {banner}
        </p>
      )}

      <div className="card card--pad-lg">
        <div className="form-grid">
          <div className="fieldset-title">Identification</div>

          <Field
            label="Tracking code"
            name="code"
            value={values.code}
            error={errors.code}
            onChange={setField}
            placeholder="AB1234"
            maxLength={8}
            required
            hint="Letters and numbers only, 2-8 characters. This is what passengers type."
          />

          <Field
            label="Airline"
            name="airline"
            value={values.airline}
            error={errors.airline}
            onChange={setField}
            placeholder="Airline name"
            required
          />

          <Field
            label="Flight number"
            name="flight_number"
            value={values.flight_number}
            error={errors.flight_number}
            onChange={setField}
            placeholder="XY 123"
            hint="Optional. A carrier code followed by a number."
          />

          <Select
            label="Travel class"
            name="travel_class"
            value={values.travel_class}
            error={errors.travel_class}
            onChange={setField}
            options={["Economy", "Premium Economy", "Business", "First"]}
          />

          <div className="fieldset-title">Route</div>

          <Field
            label="From"
            name="origin"
            value={values.origin}
            error={errors.origin}
            onChange={setField}
            placeholder="AAA"
            maxLength={8}
            required
            hint="3-letter airport code."
          />

          <Field
            label="To"
            name="destination"
            value={values.destination}
            error={errors.destination}
            onChange={setField}
            placeholder="BBB"
            maxLength={8}
            required
          />

          <div className="fieldset-title">Boarding &amp; schedule</div>

          <Field
            label="Boarding date"
            name="boarding_date"
            type="date"
            value={values.boarding_date}
            error={errors.boarding_date}
            onChange={setBoardingDate}
            required
          />

          <Field
            label="Boarding time"
            name="boarding_time"
            type="time"
            value={values.boarding_time}
            error={errors.boarding_time}
            onChange={setField}
            required
          />

          <Field
            label="Departure time"
            name="departure_time"
            type="time"
            value={values.departure_time}
            error={errors.departure_time}
            onChange={setField}
            required
          />

          <Field
            label="Arrival date"
            name="arrival_date"
            type="date"
            value={values.arrival_date}
            error={errors.arrival_date}
            onChange={setField}
            required
          />

          <Field
            label="Arrival time"
            name="arrival_time"
            type="time"
            value={values.arrival_time}
            error={errors.arrival_time}
            onChange={setField}
            required
            hint="Flight duration is calculated from departure to arrival."
          />

          <div className="fieldset-title">Terminal &amp; passenger</div>

          <Field
            label="Terminal"
            name="terminal"
            value={values.terminal}
            error={errors.terminal}
            onChange={setField}
            placeholder="1A"
          />

          <Field label="Gate" name="gate" value={values.gate} error={errors.gate} onChange={setField} placeholder="A12" />

          <Field label="Seat" name="seat" value={values.seat} error={errors.seat} onChange={setField} placeholder="14A" />

          <Field
            label="Passenger name"
            name="passenger_name"
            value={values.passenger_name}
            error={errors.passenger_name}
            onChange={setField}
            placeholder="Name on the booking"
          />

          <div className="fieldset-title">Status &amp; notes</div>

          <Select
            label="Status"
            name="status"
            value={values.status}
            error={errors.status}
            onChange={setField}
            options={[
              ["scheduled", "Scheduled"],
              ["boarding", "Boarding"],
              ["departed", "Departed"],
              ["delayed", "Delayed"],
              ["landed", "Landed"],
              ["cancelled", "Cancelled"],
            ]}
          />

          <div className="field form-grid__full">
            <label className="label" htmlFor="note">
              Note to passengers
            </label>
            <textarea
              id="note"
              name="note"
              className="textarea"
              value={values.note}
              onChange={(event) => setField("note", event.target.value)}
              placeholder="Anything passengers should know, such as a schedule change."
            />
            {errors.note && <span className="field-error">{errors.note}</span>}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create flight"}
        </button>
        <Link className="btn btn--ghost" href={backHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, name, value, onChange, error, hint, ...rest }) {
  const id = `field-${name}`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="input"
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {hint && !error && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function Select({ label, name, value, onChange, error, options }) {
  const id = `field-${name}`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="select"
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={error ? "true" : undefined}
      >
        {options.map((option) => {
          const [optValue, optLabel] = Array.isArray(option) ? option : [option, option];
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
