/**
 * Creates the admin account.
 *
 * Refuses to invent a password. You must supply ADMIN_PASSWORD, and the script
 * exits non-zero if it is missing, unset, or too weak. Nothing guessable is
 * ever written to the database or printed.
 *
 *   ADMIN_PASSWORD='your-long-passphrase' node scripts/create-admin.js
 *
 * Set ADMIN_USERNAME to override the default of "admin".
 */

const username = process.env.ADMIN_USERNAME?.trim() || "admin";
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.error("Refusing to continue: ADMIN_PASSWORD is not set.");
  console.error("");
  console.error("Generate one and re-run, for example:");
  console.error("");
  console.error('  ADMIN_PASSWORD=\'a-long-passphrase\' npm run create-admin');
  console.error("");
  console.error("If you need a suggestion, generate a random one with:");
  console.error("");
  console.error("  node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\"");
  process.exit(1);
}

// Imported after the environment check so a missing dependency does not get
// masked by a misleading password error.
const { queryOne, run } = await import("../lib/db.js");
const { hashPassword, validatePasswordStrength } = await import("../lib/password.js");

const weak = validatePasswordStrength(password);
if (weak) {
  console.error(`Refusing to continue: ${weak}`);
  process.exit(1);
}

const existing = await queryOne("SELECT id, created_at FROM admins WHERE username = $1", [username]);

if (existing) {
  console.error(`An admin named "${username}" already exists (created ${existing.created_at}).`);
  console.error("Nothing was changed.");
  console.error("");
  console.error("To change the password instead, run:");
  console.error("");
  console.error('  ADMIN_PASSWORD=\'new-passphrase\' npm run set-password');
  process.exit(1);
}

await run("INSERT INTO admins (username, password_hash) VALUES ($1, $2)", [
  username,
  hashPassword(password),
]);

console.log(`Created admin "${username}".`);
console.log("Sign in at /admin/login");
