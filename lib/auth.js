import { cookies } from "next/headers";
import { queryOne, run } from "./db.js";
import { randomToken } from "./password.js";

export const SESSION_COOKIE = "ft_session";

const SESSION_TTL_DAYS = 7;

export async function createSession(adminId) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 864e5);

  await run("INSERT INTO sessions (token, admin_id, expires_at) VALUES ($1, $2, $3)", [
    token,
    adminId,
    expires,
  ]);

  return { token, expires };
}

export async function destroySession(token) {
  if (token) await run("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function findSessionAdmin(token) {
  if (!token) return null;

  // Expiry is checked in SQL rather than in JS: it is one round trip instead of
  // two, and it cannot be fooled by a timestamp format difference. An expired
  // session is deleted by the periodic sweep, not here.
  const row = await queryOne(
    `SELECT a.id, a.username
       FROM sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token = $1
        AND s.expires_at > now()`,
    [token],
  );

  if (!row) return null;

  return { id: Number(row.id), username: row.username };
}

export async function getCurrentAdmin() {
  const store = await cookies();
  return findSessionAdmin(store.get(SESSION_COOKIE)?.value);
}

/**
 * Whether the request that created this session arrived over HTTPS.
 *
 * This must not be inferred from NODE_ENV: a production build is often served
 * over plain http on localhost or a LAN address, and marking the cookie Secure
 * there makes the browser drop it, which looks exactly like a failed login.
 * Trust the forwarded protocol so it stays correct behind a TLS proxy.
 */
export function isSecureRequest(request) {
  const proto = request?.headers?.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";

  try {
    return new URL(request?.url ?? "http://localhost").protocol === "https:";
  } catch {
    return false;
  }
}

export async function setSessionCookie(token, expires, { secure = false } = {}) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function pruneExpiredSessions() {
  // expires_at is a real TIMESTAMPTZ, so this is a plain comparison.
  await run("DELETE FROM sessions WHERE expires_at <= now()");
}

/** Revokes every session for an admin. Used after a password change. */
export async function revokeAllSessions(adminId) {
  const result = await run("DELETE FROM sessions WHERE admin_id = $1", [adminId]);
  return result.rowCount;
}
