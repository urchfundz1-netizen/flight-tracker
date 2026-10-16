import { isUniqueViolation, query, queryOne, run } from "./db.js";

export const CLASSES = ["Economy", "Premium Economy", "Business", "First"];

export const STATUSES = [
  "scheduled",
  "boarding",
  "departed",
  "delayed",
  "landed",
  "cancelled",
  "emergency",
];

const CODE_RE = /^[A-Za-z0-9]{2,8}$/;

/**
 * Airport codes are held to the same shape as tracking codes. This has to match
 * the flights_origin_format / flights_destination_format CHECK constraints
 * exactly. A looser rule here would let "N.B.O" past validation only for the
 * database to reject it, turning a form error into a 500.
 */
const AIRPORT_RE = /^[A-Za-z0-9]{2,8}$/;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FLIGHT_NUMBER_RE = /^[A-Za-z0-9]{1,4}\s?\d{1,4}$/;

export const STATUS_LABELS = {
  scheduled: "Scheduled",
  boarding: "Boarding",
  departed: "Departed",
  delayed: "Delayed",
  landed: "Landed",
  cancelled: "Cancelled",
  emergency: "Emergency landing",
};

/**
 * The statuses the clock can drive a flight through, in order. Statuses outside
 * this chain (delayed, cancelled) are treated as admin overrides that time
 * never touches.
 */
const AUTO_STATUS_ORDER = ["scheduled", "boarding", "departed", "landed"];

/** Parses a date/time pair into a UTC timestamp, matching durationMinutes. */
function timestampOf(date, time) {
  return Date.parse(`${date}T${time}:00Z`);
}

/**
 * The status the clock alone would give a flight right now.
 * Returns "scheduled" pre-boarding, "boarding" after boarding time,
 * "departed" after departure, and "landed" after arrival.
 */
export function timeBasedStatus(flight, now = new Date()) {
  const boarding = timestampOf(flight.boarding_date, flight.boarding_time);
  const departure = timestampOf(flight.boarding_date, flight.departure_time);
  const arrival = timestampOf(flight.arrival_date, flight.arrival_time);
  if ([boarding, departure, arrival].some(Number.isNaN)) return flight.status;

  const t = now.getTime();
  if (t < boarding) return "scheduled";
  if (t < departure) return "boarding";
  if (t < arrival) return "departed";
  return "landed";
}

/** Writes an entry to the flight's history log. */
export async function addFlightEvent(flightId, eventType, description) {
  await run(
    "INSERT INTO flight_events (flight_id, event_type, description) VALUES ($1, $2, $3)",
    [Number(flightId), eventType, description],
  );
}

/** Returns the most recent events for a flight, newest first. */
export async function listFlightEvents(flightId) {
  return query(
    `SELECT id, event_type, description, created_at
     FROM flight_events
     WHERE flight_id = $1
     ORDER BY id DESC
     LIMIT 100`,
    [Number(flightId)],
  );
}

/**
 * Advances a flight's status with the clock: scheduled -> boarding -> departed
 * -> landed. Admin overrides (delayed, cancelled) are left untouched, and the
 * clock never moves a status backwards. The new status is persisted and logged,
 * and the passed row is updated so callers show fresh data.
 */
export async function autoUpdateFlight(flight, now = new Date()) {
  if (!flight) return flight;
  // A manual admin choice wins over the clock until the lock is cleared.
  if (flight.status_locked) return flight;
  // Admin overrides the clock never touches: delayed, cancelled, emergency.
  if (
    flight.status === "cancelled" ||
    flight.status === "delayed" ||
    flight.status === "emergency"
  ) {
    return flight;
  }

  const derived = timeBasedStatus(flight, now);
  if (derived === flight.status) return flight;

  const before = AUTO_STATUS_ORDER.indexOf(flight.status);
  const after = AUTO_STATUS_ORDER.indexOf(derived);
  if (before === -1 || after <= before) return flight;

  const result = await run(
    "UPDATE flights SET status = $1, updated_at = now() WHERE id = $2 AND status = $3",
    [derived, Number(flight.id), flight.status],
  );

  // Compare-and-swap: if another reader already advanced this flight, the update
  // matches nothing and we leave the row alone rather than logging a duplicate.
  if (result.rowCount === 0) return flight;

  flight.status = derived;
  await addFlightEvent(
    flight.id,
    "status_auto",
    `Status auto-updated to ${STATUS_LABELS[derived] ?? derived}`,
  );
  return flight;
}

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validates and normalises a flight payload from the admin form.
 * Returns { data, errors }.
 */
export function validateFlight(input, { requireAll = true } = {}) {
  const errors = {};
  const get = (key) => (requireAll ? input?.[key] : (input?.[key] ?? ""));

  const code = clean(get("code")).toUpperCase();
  const airline = clean(get("airline"));
  const origin = clean(get("origin")).toUpperCase();
  const origin_city = clean(get("origin_city"));
  const destination = clean(get("destination")).toUpperCase();
  const destination_city = clean(get("destination_city"));
  const travel_class = clean(get("travel_class")) || "Economy";
  const terminal = clean(get("terminal"));
  const gate = clean(get("gate"));
  const seat = clean(get("seat"));
  const passenger_name = clean(get("passenger_name"));
  const boarding_date = clean(get("boarding_date"));
  const boarding_time = clean(get("boarding_time"));
  const departure_time = clean(get("departure_time"));
  const arrival_date = clean(get("arrival_date"));
  const arrival_time = clean(get("arrival_time"));
  const status = clean(get("status")) || "scheduled";
  const note = clean(get("note"));
  const emergency_airport = clean(get("emergency_airport"));
  const flight_number = clean(get("flight_number")).toUpperCase();

  if (!code) errors.code = "Tracking code is required.";
  else if (!CODE_RE.test(code))
    errors.code = "Use 2-8 letters or numbers, no spaces or dashes.";

  if (!airline) errors.airline = "Airline name is required.";
  else if (airline.length > 80)
    errors.airline = "Keep the airline name under 80 characters.";

  if (!origin) errors.origin = "Origin airport is required.";
  else if (!AIRPORT_RE.test(origin)) errors.origin = "Use 2-8 letters or numbers, e.g. NBO.";

  if (!destination) errors.destination = "Destination airport is required.";
  else if (!AIRPORT_RE.test(destination))
    errors.destination = "Use 2-8 letters or numbers, e.g. LHR.";

  if (origin && origin === destination)
    errors.destination = "Origin and destination must differ.";

  if (origin_city.length > 80)
    errors.origin_city = "Keep the city name under 80 characters.";
  if (destination_city.length > 80)
    errors.destination_city = "Keep the city name under 80 characters.";

  if (!CLASSES.includes(travel_class))
    errors.travel_class = "Choose a valid travel class.";

  if (!STATUSES.includes(status)) errors.status = "Choose a valid status.";

  if (flight_number && !FLIGHT_NUMBER_RE.test(flight_number))
    errors.flight_number = "Use a format like BA117 or KQ 100.";

  if (!boarding_date) errors.boarding_date = "Boarding date is required.";
  else if (!isValidDate(boarding_date))
    errors.boarding_date = "Enter a real calendar date.";

  if (!boarding_time) errors.boarding_time = "Boarding time is required.";
  else if (!TIME_RE.test(boarding_time))
    errors.boarding_time = "Use 24-hour HH:MM.";

  if (!departure_time) errors.departure_time = "Departure time is required.";
  else if (!TIME_RE.test(departure_time))
    errors.departure_time = "Use 24-hour HH:MM.";

  if (!arrival_date) errors.arrival_date = "Arrival date is required.";
  else if (!isValidDate(arrival_date))
    errors.arrival_date = "Enter a real calendar date.";

  if (!arrival_time) errors.arrival_time = "Arrival time is required.";
  else if (!TIME_RE.test(arrival_time))
    errors.arrival_time = "Use 24-hour HH:MM.";

  if (terminal.length > 8)
    errors.terminal = "Keep the terminal under 8 characters.";
  if (gate.length > 8) errors.gate = "Keep the gate under 8 characters.";
  if (seat.length > 8) errors.seat = "Seat format looks wrong, e.g. 14A.";
  if (passenger_name.length > 120)
    errors.passenger_name = "Keep the name under 120 characters.";
  if (note.length > 500) errors.note = "Keep the note under 500 characters.";
  if (emergency_airport.length > 120)
    errors.emergency_airport = "Keep the airport name under 120 characters.";

  if (
    !errors.boarding_time &&
    !errors.departure_time &&
    boarding_time > departure_time
  ) {
    errors.boarding_time = "Boarding must be at or before departure.";
  }

  if (
    !errors.boarding_date &&
    !errors.arrival_date &&
    arrival_date < boarding_date
  ) {
    errors.arrival_date = "Arrival cannot be before the boarding date.";
  }

  if (
    !errors.arrival_date &&
    !errors.arrival_time &&
    !errors.departure_time &&
    arrival_date === boarding_date &&
    arrival_time <= departure_time
  ) {
    errors.arrival_time = "Arrival must be after departure on the same day.";
  }

  const data = {
    code,
    airline,
    flight_number: flight_number || null,
    origin,
    origin_city: origin_city || null,
    destination,
    destination_city: destination_city || null,
    travel_class,
    terminal: terminal || null,
    gate: gate || null,
    seat: seat || null,
    passenger_name: passenger_name || null,
    boarding_date,
    boarding_time,
    departure_time,
    arrival_date,
    arrival_time,
    status,
    note: note || null,
    emergency_airport: emergency_airport || null,
  };

  return { data, errors, ok: Object.keys(errors).length === 0 };
}

export function normalizeCode(code) {
  return clean(code).toUpperCase();
}

export async function findFlightByCode(code) {
  const flight = await queryOne("SELECT * FROM flights WHERE code = $1", [
    normalizeCode(code),
  ]);
  return autoUpdateFlight(flight);
}

export async function listFlights({ search = "", status = "" } = {}) {
  const where = [];
  const params = [];

  const term = clean(search);
  if (term) {
    // ILIKE, not LIKE. Postgres LIKE is case sensitive where SQLite's was not,
    // so a plain LIKE would silently break searching for "kenya" -> "Kenya".
    where.push(
      "(code ILIKE $1 OR airline ILIKE $1 OR destination ILIKE $1 OR destination_city ILIKE $1 OR origin ILIKE $1 OR origin_city ILIKE $1 OR passenger_name ILIKE $1)",
    );
    params.push(`%${term}%`);
  }

  if (status && STATUSES.includes(status)) {
    where.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  const sql = `SELECT * FROM flights ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY boarding_date DESC, boarding_time DESC, id DESC`;
  const rows = await query(sql, params);
  for (const flight of rows) await autoUpdateFlight(flight);
  return rows;
}

export async function getFlightById(id) {
  const flight = await queryOne("SELECT * FROM flights WHERE id = $1", [Number(id)]);
  return autoUpdateFlight(flight);
}

/**
 * Checks whether a tracking code is taken.
 *
 * This narrows the error message for the common case, but it is not the
 * guarantee: two concurrent creates can both pass this check, so the caller
 * must still handle a unique violation from the database itself.
 */
export async function duplicateCodeError(code, excludeId) {
  const existing = await queryOne("SELECT id FROM flights WHERE code = $1", [
    code,
  ]);
  if (existing && Number(existing.id) !== Number(excludeId)) {
    return "That tracking code is already in use.";
  }
  return null;
}

export async function createFlight(data) {
  const dup = await duplicateCodeError(data.code, null);
  if (dup) return { ok: false, errors: { code: dup } };

  let result;
  try {
    // New flights always start unlocked, so the clock drives their status from
    // the schedule. Only an explicit admin change later pins the status.
    result = await run(
      `INSERT INTO flights (
      code, airline, flight_number, origin, origin_city, destination, destination_city,
      travel_class, terminal, gate, seat, passenger_name, boarding_date, boarding_time,
      departure_time, arrival_date, arrival_time, status, note, emergency_airport
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING id`,
      [
        data.code,
        data.airline,
        data.flight_number,
        data.origin,
        data.origin_city,
        data.destination,
        data.destination_city,
        data.travel_class,
        data.terminal,
        data.gate,
        data.seat,
        data.passenger_name,
        data.boarding_date,
        data.boarding_time,
        data.departure_time,
        data.arrival_date,
        data.arrival_time,
        data.status,
        data.note,
        data.emergency_airport,
      ],
    );
  } catch (error) {
    return asDuplicateCodeError(error);
  }

  // Postgres has no lastInsertRowid, so the id comes back from RETURNING.
  const id = Number(result.rows[0]?.id);
  await addFlightEvent(id, "flight_created", `Flight ${data.code} added to the system.`);
  return { ok: true, id };
}

/**
 * Turns a Postgres unique violation into the same friendly message the
 * pre-flight duplicate check produces. The check above narrows the common
 * case, but two concurrent creates can both pass it, and the constraint is
 * what actually guarantees codes stay unique.
 */
function asDuplicateCodeError(error) {
  if (!isUniqueViolation(error)) throw error;
  return {
    ok: false,
    errors: { code: "That tracking code is already in use." },
  };
}

export async function updateFlight(id, data) {
  const dup = await duplicateCodeError(data.code, id);
  if (dup) return { ok: false, errors: { code: dup } };

  try {
    await run(
      `UPDATE flights SET
      code = $1, airline = $2, flight_number = $3,
      origin = $4, origin_city = $5, destination = $6, destination_city = $7,
      travel_class = $8, terminal = $9, gate = $10, seat = $11, passenger_name = $12,
      boarding_date = $13, boarding_time = $14, departure_time = $15,
      arrival_date = $16, arrival_time = $17, status = $18, note = $19,
      emergency_airport = $20,
      status_locked = CASE WHEN status IS DISTINCT FROM $18 THEN true ELSE status_locked END,
      updated_at = now()
     WHERE id = $21`,
      [
        data.code,
        data.airline,
        data.flight_number,
        data.origin,
        data.origin_city,
        data.destination,
        data.destination_city,
        data.travel_class,
        data.terminal,
        data.gate,
        data.seat,
        data.passenger_name,
        data.boarding_date,
        data.boarding_time,
        data.departure_time,
        data.arrival_date,
        data.arrival_time,
        data.status,
        data.note,
        data.emergency_airport,
        Number(id),
      ],
    );
  } catch (error) {
    return asDuplicateCodeError(error);
  }

  await addFlightEvent(Number(id), "flight_updated", `Flight ${data.code} details updated.`);
  return { ok: true, id: Number(id) };
}

export async function setFlightStatus(id, status, options = {}) {
  const emergencyAirport =
    typeof options.emergency_airport === "string" && options.emergency_airport.trim()
      ? options.emergency_airport.trim()
      : null;

  // "auto" hands control back to the clock: clear the lock and recompute the
  // status the schedule implies right now.
  if (status === "auto") {
    const flight = await queryOne("SELECT * FROM flights WHERE id = $1", [Number(id)]);
    if (!flight) return { ok: false, notFound: true, errors: { form: "Flight not found." } };

    const derived = timeBasedStatus(flight);
    await run(
      "UPDATE flights SET status = $1, status_locked = false, updated_at = now() WHERE id = $2",
      [derived, Number(id)],
    );
    await addFlightEvent(
      id,
      "status_changed",
      `Status returned to automatic (${STATUS_LABELS[derived] ?? derived}).`,
    );
    return { ok: true, status: derived };
  }

  if (!STATUSES.includes(status))
    return { ok: false, errors: { status: "Unknown status." } };

  // One round trip: the CTE captures the previous status while the UPDATE
  // applies the new one, so callers no longer read the flight (and trigger an
  // auto-update) just to log what changed. status_locked pins the manual choice
  // so the clock leaves it alone from now on. COALESCE keeps any existing
  // emergency airport when the caller does not supply one.
  const result = await run(
    `WITH previous AS (SELECT status FROM flights WHERE id = $2)
     UPDATE flights SET status = $1, status_locked = true,
       emergency_airport = COALESCE($3, emergency_airport),
       updated_at = now() WHERE id = $2
     RETURNING (SELECT status FROM previous) AS previous_status`,
    [status, Number(id), emergencyAirport],
  );

  if (result.rowCount === 0)
    return { ok: false, notFound: true, errors: { form: "Flight not found." } };

  const previous = result.rows[0]?.previous_status;
  if (previous !== status) {
    await addFlightEvent(
      id,
      "status_changed",
      `Status changed from ${STATUS_LABELS[previous] ?? previous} to ${
        STATUS_LABELS[status] ?? status
      }.`,
    );
  }

  return { ok: true, status };
}

/** Shifts every time on the flight by `minutes`, rolling dates when a day boundary is crossed. */
export async function shiftFlightTimes(id, minutes) {
  const flight = await getFlightById(id);
  if (!flight) return { ok: false, errors: { form: "Flight not found." } };

  const offset = Number(minutes);
  if (!Number.isFinite(offset) || offset === 0) {
    return {
      ok: false,
      errors: { minutes: "Enter a non-zero number of minutes." },
    };
  }
  if (Math.abs(offset) > 60 * 48) {
    return { ok: false, errors: { minutes: "Shift must be within 48 hours." } };
  }

  const shift = (date, time) => {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, hh, mm) + offset * 60000);
    const iso = dt.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  };

  const boarding = shift(flight.boarding_date, flight.boarding_time);
  const departure = shift(flight.boarding_date, flight.departure_time);
  const arrival = shift(flight.arrival_date, flight.arrival_time);

  if (arrival.date < departure.date) {
    return {
      ok: false,
      errors: {
        minutes: "That shift would make the flight arrive before it departs.",
      },
    };
  }

  await run(
    `UPDATE flights SET
      boarding_date = $1, boarding_time = $2, departure_time = $3,
      arrival_date = $4, arrival_time = $5,
      updated_at = now()
     WHERE id = $6`,
    [
      boarding.date,
      boarding.time,
      departure.time,
      arrival.date,
      arrival.time,
      Number(id),
    ],
  );

  await addFlightEvent(
    Number(id),
    "schedule_shifted",
    `Schedule shifted by ${offset > 0 ? "+" : ""}${offset} min.`,
  );

  return { ok: true, id: Number(id) };
}

/**
 * Progress of the flight from departure to arrival as a 0-100 number, based on
 * the wall clock. Stays at 0 before departure and 100 after arrival.
 */
export function flightProgress(flight, now = new Date()) {
  const start = Date.parse(
    `${flight.boarding_date}T${flight.departure_time}:00Z`,
  );
  const end = Date.parse(`${flight.arrival_date}T${flight.arrival_time}:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 100;
  return ((t - start) / (end - start)) * 100;
}

/** Duration of the flight in minutes, derived from departure and arrival timestamps. */
export function durationMinutes(flight) {
  const start = Date.parse(
    `${flight.boarding_date}T${flight.departure_time}:00Z`,
  );
  const end = Date.parse(`${flight.arrival_date}T${flight.arrival_time}:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 60000));
}

export async function flightStats() {
  // Two Postgres specifics, both of which fail loudly rather than quietly:
  //   COUNT returns bigint, which the driver hands back as a string, so the
  //     ::int casts keep these usable in arithmetic.
  //   boarding_date is TEXT and CURRENT_DATE is a date, and Postgres has no
  //     operator for text = date. The cast makes it a 'YYYY-MM-DD' string
  //     comparison, matching how the column is stored.
  const row = await queryOne(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS active,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (
        WHERE boarding_date = CURRENT_DATE::text AND status <> 'cancelled'
      )::int AS today
    FROM flights
  `);

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    today: Number(row?.today ?? 0),
  };
}
