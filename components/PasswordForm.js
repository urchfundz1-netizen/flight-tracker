"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Changes the signed-in admin's password.
 *
 * The server revokes every session on success, so the browser is redirected to
 * the sign-in page afterwards rather than left on a dead page that would fail
 * on the next click.
 */
export default function PasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const current_password = form.get("current_password");
    const new_password = form.get("new_password");
    const confirm_password = form.get("confirm_password");

    // Checked here for immediate feedback. The server enforces its own rules and
    // is the only real authority.
    if (new_password !== confirm_password) {
      setError("The two new passwords do not match.");
      setPending(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password, new_password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Password change failed.");
        setPending(false);
        return;
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {error && (
        <p className="alert alert--error" style={{ margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <label className="label" htmlFor="current_password">
          Current password
        </label>
        <input
          id="current_password"
          name="current_password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="new_password">
          New password
        </label>
        <input
          id="new_password"
          name="new_password"
          type="password"
          className="input"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <p className="muted small" style={{ margin: "0.3rem 0 0" }}>
          At least 12 characters.
        </p>
      </div>

      <div className="field">
        <label className="label" htmlFor="confirm_password">
          Confirm new password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          className="input"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </div>

      <button type="submit" className="btn btn--block" disabled={pending}>
        {pending ? "Updating…" : "Change password"}
      </button>

      <p className="muted small" style={{ margin: 0 }}>
        Changing the password signs out every device, including this one.
      </p>
    </form>
  );
}
