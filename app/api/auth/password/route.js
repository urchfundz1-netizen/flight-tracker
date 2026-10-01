import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, run } from "@/lib/db";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/password";
import { clearSessionCookie, destroySession, revokeAllSessions, SESSION_COOKIE } from "@/lib/auth";
import { withAdmin } from "@/lib/api-guard";

/**
 * Changes the signed-in admin's password.
 *
 * Requires the current password even though the caller already holds a valid
 * session: an unattended or briefly-borrowed device should not be enough to
 * take the account over permanently.
 *
 * On success every session for the account is revoked, including this one, so
 * the browser is signed out and must sign in with the new password.
 */
export async function POST(request) {
  return withAdmin(request, async (admin) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Enter your current password and a new one." },
        { status: 400 },
      );
    }

    const weak = validatePasswordStrength(newPassword);
    if (weak) {
      return NextResponse.json({ error: weak, field: "new_password" }, { status: 400 });
    }

    const row = await queryOne("SELECT id, password_hash FROM admins WHERE id = $1", [admin.id]);
    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      return NextResponse.json(
        { error: "Your current password is not correct.", field: "current_password" },
        { status: 401 },
      );
    }

    await run("UPDATE admins SET password_hash = $1 WHERE id = $2", [
      hashPassword(newPassword),
      admin.id,
    ]);

    const store = await cookies();
    const revoked = await revokeAllSessions(admin.id);
    await destroySession(store.get(SESSION_COOKIE)?.value);
    await clearSessionCookie();

    return NextResponse.json({
      ok: true,
      revoked,
      message: "Password updated. Please sign in again.",
    });
  });
}
