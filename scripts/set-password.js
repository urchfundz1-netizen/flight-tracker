/**
 * Changes the password of an existing admin account.
 *
 *   ADMIN_PASSWORD='new-long-passphrase' npm run set-password
 *
 * Passing the current password is required so that someone who found a stray
 * terminal with this command's env vars still cannot silently take over the
 * account. Every existing session is revoked, since a password change is
 * normally a response to a suspected compromise.
 *
 * Set CURRENT_PASSWORD to confirm the change, or leave it unset if you are
 * locked out and are deliberately performing a recovery from the server.
 */

const username = process.env.ADMIN_USERNAME?.trim() || "admin";
const newPassword = process.env.ADMIN_PASSWORD;
const currentPassword = process.env.CURRENT_PASSWORD;

if (!newPassword) {
  console.error("Refusing to continue: ADMIN_PASSWORD (the new password) is not set.");
  console.error("");
  console.error('  ADMIN_PASSWORD=\'new-long-passphrase\' npm run set-password');
  process.exit(1);
}

const { queryOne, run } = await import("../lib/db.js");
const { hashPassword, verifyPassword, validatePasswordStrength } = await import("../lib/password.js");

const weak = validatePasswordStrength(newPassword);
if (weak) {
  console.error(`Refusing to continue: ${weak}`);
  process.exit(1);
}

const admin = await queryOne("SELECT id, username FROM admins WHERE username = $1", [username]);

if (!admin) {
  console.error(`No admin named "${username}" exists.`);
  console.error("Create it first with: npm run create-admin");
  process.exit(1);
}

const stored = await queryOne("SELECT password_hash FROM admins WHERE id = $1", [admin.id]);
const isRecovery = !currentPassword;

if (!isRecovery && !verifyPassword(currentPassword, stored.password_hash)) {
  console.error("CURRENT_PASSWORD does not match. Nothing was changed.");
  process.exit(1);
}

await run("UPDATE admins SET password_hash = $1 WHERE id = $2", [hashPassword(newPassword), admin.id]);

const revoked = await run("DELETE FROM sessions WHERE admin_id = $1", [admin.id]);

console.log(`Password updated for "${admin.username}".`);
if (isRecovery) {
  console.log("Recovery mode: CURRENT_PASSWORD was not supplied.");
  console.log("Every existing session was revoked.");
} else {
  console.log(`Revoked ${revoked.rowCount} existing session(s).`);
}
console.log("Sign in again at /admin/login");
