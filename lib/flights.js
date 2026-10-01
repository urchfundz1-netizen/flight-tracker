import { isUniqueViolation, query, queryOne, run } from "./db.js";

export const CLASSES = ["Economy", "Premium Economy", "Business", "First"];

export const STATUSES = [
  "scheduled",
  "boarding",
  "departed",
  "delayed",
  "landed",
  "cancelled",
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
};

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
  const destination = clean(get("destination")).toUpperCase();
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
    destination,
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
  };

  return { data, errors, ok: Object.keys(errors).length === 0 };
}

export function normalizeCode(code) {
  return clean(code).toUpperCase();
}

export async function findFlightByCode(code) {
  return queryOne("SELECT * FROM flights WHERE code = $1", [
    normalizeCode(code),
  ]);
}

export async function listFlights({ search = "", status = "" } = {}) {
  const where = [];
  const params = [];

  const term = clean(search);
  if (term) {
    // ILIKE, not LIKE. Postgres LIKE is case sensitive where SQLite's was not,
    // so a plain LIKE would silently break searching for "kenya" -> "Kenya".
    where.push(
      "(code ILIKE $1 OR airline ILIKE $1 OR destination ILIKE $1 OR origin ILIKE $1 OR passenger_name ILIKE $1)",
    );
    params.push(`%${term}%`);
  }

  if (status && STATUSES.includes(status)) {
    where.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  const sql = `SELECT * FROM flights ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY boarding_date DESC, boarding_time DESC, id DESC`;
  return query(sql, params);
}

export async function getFlightById(id) {
  return queryOne("SELECT * FROM flights WHERE id = $1", [Number(id)]);
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
    result = await run(
      `INSERT INTO flights (
      code, airline, flight_number, origin, destination, travel_class,
      terminal, gate, seat, passenger_name, boarding_date, boarding_time,
      departure_time, arrival_date, arrival_time, status, note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id`,
      [
        data.code,
        data.airline,
        data.flight_number,
        data.origin,
        data.destination,
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
      ],
    );
  } catch (error) {
    return asDuplicateCodeError(error);
  }

  // Postgres has no lastInsertRowid, so the id comes back from RETURNING.
  return { ok: true, id: Number(result.rows[0]?.id) };
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
      code = $1, airline = $2, flight_number = $3, origin = $4, destination = $5,
      travel_class = $6, terminal = $7, gate = $8, seat = $9, passenger_name = $10,
      boarding_date = $11, boarding_time = $12, departure_time = $13,
      arrival_date = $14, arrival_time = $15, status = $16, note = $17,
      updated_at = now()
     WHERE id = $18`,
      [
        data.code,
        data.airline,
        data.flight_number,
        data.origin,
        data.destination,
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
        Number(id),
      ],
    );
  } catch (error) {
    return asDuplicateCodeError(error);
  }

  return { ok: true, id: Number(id) };
}

export async function setFlightStatus(id, status) {
  if (!STATUSES.includes(status))
    return { ok: false, errors: { status: "Unknown status." } };

  await run(
    "UPDATE flights SET status = $1, updated_at = now() WHERE id = $2",
    [status, Number(id)],
  );
  return { ok: true };
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

  return { ok: true, id: Number(id) };
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
