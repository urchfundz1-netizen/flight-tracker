import crypto from "node:crypto";
import { query, run } from "./db.js";

/**
 * Fixed-window rate limiting backed by the database.
 *
 * A shared store is required: an in-memory counter is per-instance, so behind a
 * serverless load balancer every instance would count separately and the limit
 * would be meaningless. This is why login_attempts exists as a table.
 */

const WINDOW_MS = 15 * 60 * 1000;

/** Failures allowed before the key is locked out. */
const MAX_FAILURES = 8;

/** How long a lockout lasts once tripped. */
const LOCKOUT_MS = 15 * 60 * 1000;

/** Probabilistic cleanup rate, so the table does not grow without bound. */
const CLEANUP_SAMPLE = 1 / 50;

function keyFor(scope, identifier) {
  // Hashed so an attacker cannot use the table to confirm which usernames or
  // addresses exist, and so identifiers are a fixed length.
  return crypto
    .createHash("sha256")
    .update(`${scope}:${identifier}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Records a failure and returns the new state, or locks the key out.
 */
export async function recordFailure(scope, identifier) {
  const key = keyFor(scope, identifier);

  const row = await query(
    `INSERT INTO login_attempts (key, failures, updated_at)
     VALUES ($1, 1, now())
     ON CONFLICT (key) DO UPDATE SET
       failures = login_attempts.failures + 1,
       locked_until = CASE
         WHEN login_attempts.locked_until > now() THEN login_attempts.locked_until
         WHEN login_attempts.failures + 1 >= $2 THEN now() + make_interval(secs => $3)
         ELSE NULL
       END,
       updated_at = now()
     RETURNING failures, locked_until`,
    [key, MAX_FAILURES, LOCKOUT_MS / 1000],
  );

  await maybeCleanup();

  const state = row[0];
  return {
    failures: Number(state?.failures ?? 1),
    lockedUntil: state?.locked_until ? new Date(state.locked_until).getTime() : null,
  };
}

/** Clears the counter after a successful sign-in. */
export async function clearFailures(scope, identifier) {
  await run("DELETE FROM login_attempts WHERE key = $1", [keyFor(scope, identifier)]);
}

/**
 * Returns milliseconds until the key unlocks, or 0 when it is not locked.
 * Callers should treat any non-zero result as a rejection.
 */
export async function lockoutRemaining(scope, identifier) {
  const row = await query(
    `SELECT locked_until FROM login_attempts
      WHERE key = $1 AND locked_until > now()`,
    [keyFor(scope, identifier)],
  );

  const until = row[0]?.locked_until;
  if (!until) return 0;

  return Math.max(0, new Date(until).getTime() - Date.now());
}

async function maybeCleanup() {
  if (Math.random() > CLEANUP_SAMPLE) return;

  await run(
    `DELETE FROM login_attempts
      WHERE locked_until IS NULL
        AND updated_at < now() - make_interval(secs => $1)`,
    [(WINDOW_MS * 8) / 1000],
  ).catch(() => {
    // Cleanup is opportunistic housekeeping. A failure here must never turn a
    // successful login into an error, so it is deliberately swallowed.
  });
}
