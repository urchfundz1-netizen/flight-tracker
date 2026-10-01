import crypto from "node:crypto";

const KEYLEN = 64;

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Hashes a password with scrypt and a random per-password salt.
 * Format: scrypt$<salt hex>$<derived key hex>
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, KEYLEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifies a password against a stored hash in constant time.
 * Returns false for any malformed hash rather than throwing.
 */
export function verifyPassword(password, stored) {
  const [scheme, salt, expected] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;

  const derived = crypto.scryptSync(password, salt, KEYLEN);
  const expectedBuf = Buffer.from(expected, "hex");
  if (derived.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(derived, expectedBuf);
}

/** Generates a URL-safe random token, used for session identifiers. */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Human-readable strength check for user-supplied passwords.
 * Rejects anything short, and anything that is a single repeated character
 * or an obvious placeholder, both of which defeat the hashing entirely.
 */
export function validatePasswordStrength(password) {
  const value = String(password ?? "");

  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > 200) {
    return "Keep the password under 200 characters.";
  }
  if (/^(.)\1+$/.test(value)) {
    return "That is a single repeated character. Choose something longer.";
  }

  const lowered = value.toLowerCase();
  const banned = [
    "password",
    "passw0rd",
    "letmein",
    "admin",
    "flightadmin",
    "administrator",
    "changeme",
    "welcome",
    "qwerty",
    "123456",
  ];
  if (banned.some((word) => lowered.includes(word))) {
    return "That password contains a very common word. Choose something harder to guess.";
  }

  return null;
}
