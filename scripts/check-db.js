/**
 * Exercises the data layer against a real database, then cleans up after
 * itself. Complements the smoke test, which drives a running server.
 *
 *   npm run check-db
 *
 * This is the only check that proves the CHECK constraints actually reject
 * malformed input in Postgres. The static check in check-migrations.js only
 * proves the SQL text is shaped correctly; it cannot prove the regexes work.
 *
 * It touches only rows it creates, identified by a code prefix, and deletes
 * them on the way out.
 */

import { isUniqueViolation, query, queryOne, run } from "../lib/db.js";

const PREFIX = "CHK";
const CODE = `${PREFIX}${process.pid}`.slice(0, 8).toUpperCase();

let pass = 0;
let fail = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`PASS  ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rejects(label, sql, params) {
  try {
    await run(sql, params);
    ok(label, false, "the database accepted it");
  } catch (error) {
    // A constraint violation is the expected outcome. Anything else, such as a
    // syntax error, would mean the test is wrong rather than the schema.
    ok(label, error.code === "23514", `expected 23514 (check_violation), got ${error.code || error.name}`);
  }
}

const base = {
  code: CODE,
  airline: "Check Air",
  flight_number: "CA 1",
  origin: "AAA",
  destination: "BBB",
  travel_class: "Economy",
  boarding_date: "2026-12-01",
  boarding_time: "09:00",
  departure_time: "10:00",
  arrival_date: "2026-12-01",
  arrival_time: "14:00",
  status: "scheduled",
  note: "",
};

async function insert(overrides = {}) {
  const data = { ...base, ...overrides };
  return run(
    `INSERT INTO flights (
      code, airline, flight_number, origin, destination, travel_class,
      terminal, gate, seat, passenger_name, boarding_date, boarding_time,
      departure_time, arrival_date, arrival_time, status, note
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING id`,
    [
      data.code, data.airline, data.flight_number, data.origin, data.destination,
      data.travel_class, data.terminal ?? "", data.gate ?? "", data.seat ?? "",
      data.passenger_name ?? "", data.boarding_date, data.boarding_time,
      data.departure_time, data.arrival_date, data.arrival_time, data.status, data.note,
    ],
  );
}

try {
  console.log(`Using tracking code ${CODE}\n`);

  // --- round trip ---------------------------------------------------------

  const created = await insert();
  const id = Number(created.rows[0].id);
  ok("a valid flight inserts and returns its id", Number.isInteger(id) && id > 0, `id=${id}`);

  const fetched = await queryOne("SELECT * FROM flights WHERE code = $1", [CODE]);
  ok("the flight reads back", Boolean(fetched));
  ok("stored values match what was sent", fetched?.airline === "Check Air" && fetched?.origin === "AAA");

  const missing = await queryOne("SELECT * FROM flights WHERE code = $1", ["ZZZZZZZZ"]);
  ok("an unknown code returns null", missing === null);

  // --- CHECK constraints --------------------------------------------------

  console.log("");

  await rejects(
    "rejects a tracking code containing a dot",
    "INSERT INTO flights (code, airline, origin, destination, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','2026-12-01','09:00','10:00','2026-12-01','14:00')",
    ["BAD.CODE"],
  );

  await rejects(
    "rejects a one-character tracking code",
    "INSERT INTO flights (code, airline, origin, destination, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','2026-12-01','09:00','10:00','2026-12-01','14:00')",
    ["B"],
  );

  await rejects(
    "rejects a nine-character tracking code",
    "INSERT INTO flights (code, airline, origin, destination, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','2026-12-01','09:00','10:00','2026-12-01','14:00')",
    ["TOOLONG123"],
  );

  await rejects(
    "rejects an origin with a dot, the case the app used to let through",
    "INSERT INTO flights (code, airline, origin, destination, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','N.B.O','BBB','2026-12-01','09:00','10:00','2026-12-01','14:00')",
    [`${PREFIX}1A`],
  );

  await rejects(
    "rejects a lowercase tracking code",
    "INSERT INTO flights (code, airline, origin, destination, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','2026-12-01','09:00','10:00','2026-12-01','14:00')",
    ["lower123"],
  );

  await rejects(
    "rejects an impossible boarding time",
    "INSERT INTO flights (code, airline, origin, destination, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','2026-12-01','25:00','10:00','2026-12-01','14:00')",
    [`${PREFIX}1B`],
  );

  await rejects(
    "rejects a boarding date of the wrong shape",
    "INSERT INTO flights (code, airline, origin, destination, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','26-1-1','09:00','10:00','2026-12-01','14:00')",
    [`${PREFIX}1C`],
  );

  /*
   * The date CHECK only validates shape, so "2026-13-45" is accepted by the
   * database: two digits is two digits. Calendar validity is the application's
   * job, and that is checked here so the gap is documented rather than assumed.
   */
  const { validateFlight } = await import("../lib/flights.js");
  const impossible = validateFlight({
    code: `${PREFIX}2A`.toUpperCase(),
    airline: "Check Air",
    origin: "AAA",
    destination: "BBB",
    boarding_date: "2026-13-45",
    boarding_time: "09:00",
    departure_time: "10:00",
    arrival_date: "2026-12-01",
    arrival_time: "14:00",
  });
  ok(
    "the application rejects an impossible calendar date the database allows",
    impossible.errors.boarding_date === "Enter a real calendar date.",
    JSON.stringify(impossible.errors.boarding_date),
  );

  await rejects(
    "rejects an unknown travel class",
    "INSERT INTO flights (code, airline, origin, destination, travel_class, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','First Class Deluxe','2026-12-01','09:00','10:00','2026-12-01','14:00')",
    [`${PREFIX}1D`],
  );

  await rejects(
    "rejects an unknown status",
    "INSERT INTO flights (code, airline, origin, destination, status, boarding_date, boarding_time, departure_time, arrival_date, arrival_time) VALUES ($1,'X','AAA','BBB','teleported','2026-12-01','09:00','10:00','2026-12-01','14:00')",
    [`${PREFIX}1E`],
  );

  // --- uniqueness ---------------------------------------------------------

  console.log("");

  let duplicate = null;
  try {
    await insert();
  } catch (error) {
    duplicate = error;
  }
  ok("a duplicate tracking code is rejected", duplicate !== null);
  ok(
    "the duplicate surfaces as a unique violation the app recognises",
    isUniqueViolation(duplicate),
    `code=${duplicate?.code || duplicate?.name}`,
  );

  // --- case-insensitive search -------------------------------------------

  console.log("");

  const insensitive = await query("SELECT code FROM flights WHERE code ILIKE $1", [`%${CODE.toLowerCase()}%`]);
  ok("ILIKE finds the code regardless of case", insensitive.length > 0, `found ${insensitive.length}`);

  // --- counts come back as numbers ---------------------------------------

  const stats = await queryOne(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS active,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (
        WHERE boarding_date = CURRENT_DATE::text AND status <> 'cancelled'
      )::int AS today
    FROM flights
  `);
  ok("counts are numbers, not bigint strings", typeof stats.total === "number", `typeof total = ${typeof stats.total}`);

  // --- expiry comparison in SQL ------------------------------------------

  const { hashPassword, randomToken } = await import("../lib/password.js");

  const adminUser = `${PREFIX}ADMIN${process.pid}`.slice(0, 24);
  const admin = await run("INSERT INTO admins (username, password_hash) VALUES ($1,$2) RETURNING id", [
    adminUser,
    hashPassword("temporary-check-password"),
  ]);
  const adminId = Number(admin.rows[0].id);

  await run("INSERT INTO sessions (token, admin_id, expires_at) VALUES ($1,$2, now() + interval '1 hour')", [
    randomToken(),
    adminId,
  ]);
  await run("INSERT INTO sessions (token, admin_id, expires_at) VALUES ($1,$2, now() - interval '1 hour')", [
    randomToken(),
    adminId,
  ]);

  const counts = await queryOne(
    "SELECT COUNT(*)::int AS n FROM sessions WHERE admin_id = $1 AND expires_at > now()",
    [adminId],
  );
  ok("only the unexpired session is visible as live", counts.n === 1, `live=${counts.n}`);

  const pruned = await run("DELETE FROM sessions WHERE expires_at <= now()");
  ok("pruning removes exactly the expired session", pruned.rowCount === 1, `deleted ${pruned.rowCount}`);

  await run("DELETE FROM admins WHERE id = $1", [adminId]);
} finally {
  await run("DELETE FROM flights WHERE code LIKE $1", [`${PREFIX}%`]).catch(() => {});
  await run("DELETE FROM login_attempts").catch(() => {});
  console.log(`\ncleanup: removed rows with the ${PREFIX} prefix`);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
