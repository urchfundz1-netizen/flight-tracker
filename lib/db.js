import { neon } from "@neondatabase/serverless";

/**
 * Each migration is an explicit list of statements, applied once and recorded
 * by name. Append only: never edit a shipped entry, add a new one instead.
 *
 * Statements are listed rather than stored as one blob so they can be sent as
 * separate queries inside a single transaction. Splitting a string on
 * semicolons would break the moment a statement contained a semicolon inside a
 * literal or a dollar-quoted block.
 */
const migrations = [
  {
    name: "001_initial_schema",
    statements: [
      `CREATE TABLE IF NOT EXISTS admins (
        id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,

      `CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS flights (
        id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        code           TEXT NOT NULL UNIQUE,
        airline        TEXT NOT NULL,
        flight_number  TEXT,
        origin         TEXT NOT NULL,
        destination    TEXT NOT NULL,
        travel_class   TEXT NOT NULL DEFAULT 'Economy',
        terminal       TEXT,
        gate           TEXT,
        seat           TEXT,
        passenger_name TEXT,
        boarding_date  TEXT NOT NULL,
        boarding_time  TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        arrival_date   TEXT NOT NULL,
        arrival_time   TEXT NOT NULL,
        status         TEXT NOT NULL DEFAULT 'scheduled',
        note           TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

        -- Guards against a malformed tracking code reaching the database. The
        -- application validates too, but this is the last line of defence.
        --
        -- No escaping is needed on these three. A JS template literal only
        -- interpolates on a dollar immediately followed by a brace, and here the
        -- only dollar is the trailing anchor. Escaping it anyway bound the
        -- quantifier to the anchor instead of the character class, and Postgres
        -- rejects that with "quantifier operand invalid" on the first insert.
        CONSTRAINT flights_code_format CHECK (code ~ '^[A-Z0-9]{2,8}$'),
        CONSTRAINT flights_origin_format CHECK (origin ~ '^[A-Z0-9]{2,8}$'),
        CONSTRAINT flights_destination_format CHECK (destination ~ '^[A-Z0-9]{2,8}$'),

        CONSTRAINT flights_boarding_date CHECK (boarding_date ~ '^\\d{4}-\\d{2}-\\d{2}\$'),
        CONSTRAINT flights_arrival_date CHECK (arrival_date ~ '^\\d{4}-\\d{2}-\\d{2}\$'),
        CONSTRAINT flights_boarding_time CHECK (boarding_time ~ '^([01]\\d|2[0-3]):[0-5]\\d\$'),
        CONSTRAINT flights_departure_time CHECK (departure_time ~ '^([01]\\d|2[0-3]):[0-5]\\d\$'),
        CONSTRAINT flights_arrival_time CHECK (arrival_time ~ '^([01]\\d|2[0-3]):[0-5]\\d\$'),

        CONSTRAINT flights_travel_class CHECK (
          travel_class IN ('Economy', 'Premium Economy', 'Business', 'First')
        ),
        CONSTRAINT flights_status CHECK (
          status IN ('scheduled', 'boarding', 'departed', 'delayed', 'landed', 'cancelled')
        )
      )`,

      `CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at)`,
      `CREATE INDEX IF NOT EXISTS flights_code_idx ON flights(code)`,
      `CREATE INDEX IF NOT EXISTS flights_boarding_idx ON flights(boarding_date, boarding_time)`,
    ],
  },
  {
    name: "002_login_attempts",
    statements: [
      // Rate limiting needs a shared store: an in-memory counter is per-instance
      // and therefore useless behind a serverless load balancer.
      `CREATE TABLE IF NOT EXISTS login_attempts (
        key          TEXT PRIMARY KEY,
        failures     INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    // Repairs the three code-shape constraints created by 001. The regexes were
    // written as '^[A-Z0-9]${2,8}$', where the quantifier ended up applied to
    // the end anchor. Postgres accepts that constraint at DDL time and only
    // fails when a row is inserted, so the error surfaced as a 2201B on the
    // first write rather than as a migration failure.
    //
    // IF EXISTS keeps this safe on a fresh database, where the corrected 001
    // has already created them.
    name: "003_fix_code_format_constraints",
    statements: [
      `ALTER TABLE flights DROP CONSTRAINT IF EXISTS flights_code_format`,
      `ALTER TABLE flights DROP CONSTRAINT IF EXISTS flights_origin_format`,
      `ALTER TABLE flights DROP CONSTRAINT IF EXISTS flights_destination_format`,

      `ALTER TABLE flights ADD CONSTRAINT flights_code_format
        CHECK (code ~ '^[A-Z0-9]{2,8}$')`,
      `ALTER TABLE flights ADD CONSTRAINT flights_origin_format
        CHECK (origin ~ '^[A-Z0-9]{2,8}$')`,
      `ALTER TABLE flights ADD CONSTRAINT flights_destination_format
        CHECK (destination ~ '^[A-Z0-9]{2,8}$')`,
    ],
  },
];

/** Arbitrary constant used as the migration advisory lock id. */
const MIGRATION_LOCK_KEY = 8412077;

export { migrations };

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Neon pooled connection string.",
    );
  }
  return url;
}

const globalForDb = globalThis;

/**
 * The Neon driver is stateless HTTP, so there is no connection to pool and no
 * socket to leak across serverless invocations. Caching the constructed client
 * on globalThis only avoids rebuilding the function per request.
 */
export function sql() {
  if (!globalForDb.__ftSql) {
    globalForDb.__ftSql = neon(connectionString());
  }
  return globalForDb.__ftSql;
}

/** Runs a SELECT and returns the rows. */
export async function query(text, params = []) {
  await ready();
  return sql().query(text, params);
}

/** Runs a SELECT and returns the first row, or null. */
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/**
 * Runs a write and returns { rowCount, rows }. Postgres reports counts as
 * bigint, which the driver hands back as a string, so it is normalised to a
 * number here to keep callers from doing arithmetic on strings by accident.
 */
export async function run(text, params = []) {
  await ready();
  const result = await sql().query(text, params, { fullResults: true });
  return {
    rowCount: Number(result.rowCount ?? 0),
    rows: result.rows ?? [],
  };
}

/** Postgres unique-violation SQLSTATE. */
export const UNIQUE_VIOLATION = "23505";

/** True when a Postgres error is a unique-constraint violation. */
export function isUniqueViolation(error) {
  return error?.code === UNIQUE_VIOLATION || error?.cause?.code === UNIQUE_VIOLATION;
}

const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * Applies any migrations this database has not seen yet.
 *
 * Every statement is idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING), so
 * re-running is harmless. That is what makes this safe against the one race
 * serverless cannot avoid: two cold instances starting at the same moment.
 * Both will run the DDL, and because it is idempotent and wrapped in a
 * transaction, one of them succeeds and the other sees no change.
 *
 * The advisory lock is transaction-scoped (pg_advisory_xact_lock), not
 * session-scoped. That distinction matters: the driver is stateless HTTP, so a
 * session lock acquired by one request is already gone by the next one, and
 * would provide no mutual exclusion at all.
 *
 * @returns the number of migrations applied.
 */
export async function migrate() {
  const client = sql();

  await client.query(MIGRATION_TABLE_SQL);

  // Note that this read happens outside the advisory lock, so several instances
  // racing a cold start can all conclude the same migration is pending. That is
  // safe: the lock serialises them, every statement is idempotent, and the
  // ledger insert is ON CONFLICT DO NOTHING, so the second instance finds the
  // row already present and changes nothing. It costs redundant DDL, not
  // correctness. The lock could not be held across this read because the Neon
  // driver's transaction() takes a list of queries rather than a callback.
  const before = new Set(
    (await client.query("SELECT name FROM schema_migrations")).map((row) => row.name),
  );

  for (const migration of migrations) {
    if (before.has(migration.name)) continue;

    // The array form builds the whole statement list up front, so the lock, the
    // DDL and the ledger insert are guaranteed to share one transaction.
    await client.transaction((txn) => [
      txn.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]),
      ...migration.statements.map((statement) => txn.query(statement)),
      txn.query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [
        migration.name,
      ]),
    ]);
  }

  const after = new Set(
    (await client.query("SELECT name FROM schema_migrations")).map((row) => row.name),
  );

  // Only claim what this process actually changed, so a racing instance that
  // found the migration already present does not log that it applied it.
  const applied = migrations.filter((m) => !before.has(m.name) && after.has(m.name));
  for (const migration of applied) {
    console.log(`[db] applied migration ${migration.name}`);
  }

  return applied.length;
}

let migratePromise = null;

/**
 * Coalesces concurrent migration attempts into a single in-flight run. Every
 * query waits on this, so a cold start migrates once and all the requests
 * racing it simply await the same promise.
 */
function ready() {
  if (!migratePromise) {
    migratePromise = migrate().catch((error) => {
      // Cleared so a transient failure does not poison the process forever; the
      // next request retries.
      migratePromise = null;
      throw error;
    });
  }
  return migratePromise;
}
