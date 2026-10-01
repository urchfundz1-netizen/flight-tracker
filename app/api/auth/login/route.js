import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { hashPassword, randomToken, verifyPassword } from "@/lib/password";
import { createSession, isSecureRequest, pruneExpiredSessions, setSessionCookie } from "@/lib/auth";
import { clearFailures, lockoutRemaining, recordFailure } from "@/lib/rate-limit";
import { requireSameOrigin } from "@/lib/api-guard";

/** Best-effort client identity for rate limiting. */
function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * A real, correctly-shaped hash of a value nobody can guess. Comparing against
 * this when the account is unknown makes a missing user and a wrong password
 * take the same amount of time, so response timing does not confirm which
 * usernames exist. Generated at module load, so it differs per process.
 */
const DUMMY_HASH = hashPassword(randomToken());

export async function POST(request) {
  const crossOrigin = requireSameOrigin(request);
  if (crossOrigin) return crossOrigin;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  // Both the address and the username are limited. The address key stops one
  // host from spraying many usernames; the username key stops one account from
  // being attacked from a botnet.
  const scopes = [
    ["ip", clientKey(request)],
    ["user", username],
  ];

  for (const [scope, identifier] of scopes) {
    const remaining = await lockoutRemaining(scope, identifier);
    if (remaining > 0) {
      const minutes = Math.max(1, Math.ceil(remaining / 60000));
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(remaining / 1000)) } },
      );
    }
  }

  const admin = await queryOne(
    "SELECT id, username, password_hash FROM admins WHERE username = $1",
    [username],
  );

  // Verify even when the user is unknown, so a missing account and a wrong
  // password take the same amount of time.
  const stored = admin?.password_hash ?? DUMMY_HASH;
  const valid = verifyPassword(password, stored);

  if (!admin || !valid) {
    let state = null;
    for (const [scope, identifier] of scopes) {
      const updated = await recordFailure(scope, identifier);
      // Keep the state with the furthest lockout, since either scope can be the
      // one that trips.
      if (!state || (updated.lockedUntil ?? 0) > (state.lockedUntil ?? 0)) {
        state = updated;
      }
    }

    // Say so on the attempt that actually trips the lock. Reporting a plain
    // "wrong password" here left the user with no way to tell a typo apart
    // from an account that had just been locked out from under them.
    const remaining = state?.lockedUntil ? state.lockedUntil - Date.now() : 0;
    if (remaining > 0) {
      const minutes = Math.max(1, Math.ceil(remaining / 60000));
      return NextResponse.json(
        {
          error: `Too many failed attempts. This account is now locked for ${minutes} minute${
            minutes === 1 ? "" : "s"
          }.`,
          locked: true,
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(remaining / 1000)) } },
      );
    }

    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  for (const [scope, identifier] of scopes) {
    await clearFailures(scope, identifier);
  }

  // Housekeeping, not part of the request's correctness. Never let it turn a
  // valid login into a failure.
  await pruneExpiredSessions().catch((error) => {
    console.error("[auth] session prune failed:", error);
  });

  const { token, expires } = await createSession(admin.id);
  await setSessionCookie(token, expires, { secure: isSecureRequest(request) });

  return NextResponse.json({ ok: true, username: admin.username });
}
