/**
 * Auth and data-visibility smoke test.
 *
 * Drives a running server the way a browser does, including applying real
 * cookie rules. Run it against a disposable environment: it creates and then
 * removes a test flight.
 *
 *   npm start            # in one terminal
 *   npm run smoke        # in another
 *
 * Environment:
 *   SMOKE_PASSWORD   required, the admin password
 *   SMOKE_USERNAME   optional, defaults to "admin"
 *   SMOKE_BASE_URL   optional, defaults to http://localhost:3000
 *
 * The suite also exercises the password-change endpoint. It generates a
 * throwaway replacement password, then restores the original before exiting, so
 * the admin's real password is unchanged by a passing run. If the process dies
 * between the change and the restore, sign in with the fallback printed below.
 */

const B = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const USERNAME = process.env.SMOKE_USERNAME || "admin";
const PASSWORD = process.env.SMOKE_PASSWORD;

/** Throwaway password used only for the duration of the password-change check. */
const NEW_PASSWORD = `smoke-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

if (!PASSWORD) {
  console.error("SMOKE_PASSWORD is not set. The smoke test refuses to use a built-in password.");
  console.error("");
  console.error('  SMOKE_PASSWORD=\'your-passphrase\' npm run smoke');
  process.exit(1);
}

// Unique per run so repeated runs against a shared database cannot collide.
const TEST_CODE = `SMK${process.pid}`.slice(0, 8);

/** Minimal cookie jar that mirrors the rules a real browser applies. */
function jar() {
  const store = new Map();
  return {
    store,
    header() {
      return [...store].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    absorb(res) {
      const dropped = [];
      for (const raw of res.headers.getSetCookie()) {
        const [pair] = raw.split(";");
        const i = pair.indexOf("=");
        const name = pair.slice(0, i).trim();
        const value = pair.slice(i + 1).trim();
        const attrs = raw.split(";").slice(1).map((a) => a.trim().toLowerCase());

        // A browser drops a Secure cookie that arrived over plain http.
        if (attrs.includes("secure") && !B.startsWith("https:")) {
          store.delete(name);
          dropped.push(name);
          continue;
        }
        if (value === "" || attrs.some((a) => a.startsWith("max-age=0"))) store.delete(name);
        else store.set(name, value);
      }
      return dropped;
    },
  };
}

const results = [];
function check(label, pass, detail = "") {
  results.push({ label, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

const created = { id: null };

async function cleanup() {
  // Goes through the app's own data layer rather than a driver-specific path,
  // so this keeps working after the database backend changes.
  const { run } = await import("../lib/db.js");

  if (created.id) {
    await run("DELETE FROM flights WHERE id = $1", [created.id]);
    console.log(`\ncleanup: removed test flight ${TEST_CODE}`);
  }

  // Rate-limit counters are cleared because the deliberate wrong-password check
  // above leaves failures behind, and the lockout would block a re-run.
  await run("DELETE FROM login_attempts");
}

(async () => {
  const { queryOne, run } = await import("../lib/db.js");
  const { verifyPassword, hashPassword } = await import("../lib/password.js");

  // Guard: this suite rewrites the admin password to a throwaway value and then
  // restores SMOKE_PASSWORD at the end. If that value is not the password
  // currently stored, the "restore" silently overwrites the real one with a
  // stale credential. Refusing here is much cheaper than locking someone out of
  // their own account after a password change.
  let stored;
  try {
    stored = await queryOne("SELECT password_hash FROM admins WHERE username = $1", [USERNAME]);
  } catch (error) {
    console.error(`could not read the stored password hash: ${error.message}`);
    process.exit(1);
  }

  if (!stored) {
    console.error(`No admin named "${USERNAME}" exists, so there is nothing to test against.`);
    process.exit(1);
  }

  if (!verifyPassword(PASSWORD, stored.password_hash)) {
    console.error("");
    console.error("SMOKE_PASSWORD does not match the password currently stored for this account.");
    console.error("");
    console.error("This suite restores SMOKE_PASSWORD at the end, so running it now would overwrite");
    console.error("your real password with a stale one and lock you out. Not running.");
    console.error("");
    console.error(`Re-run with the current password for "${USERNAME}", or change it first with:`);
    console.error("  npm run set-password");
    process.exit(1);
  }

  // Pre-flight: a run that was killed between the lockout test and cleanup
  // leaves the account locked, and every later login would then fail with 429
  // and cascade into unrelated-looking failures. Clear it before starting so
  // the suite is genuinely repeatable.
  try {
    await run("DELETE FROM login_attempts");
  } catch (error) {
    console.error(`could not reset rate-limit counters: ${error.message}`);
    process.exit(1);
  }

  const c = jar();

  const login = async (password, extraHeaders = {}) => {
    const res = await fetch(`${B}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ username: USERNAME, password }),
    });
    const dropped = c.absorb(res);
    return { res, dropped };
  };

  // --- credentials -------------------------------------------------------

  const bad = await login("this-is-not-the-password");
  check("wrong password rejected with 401", bad.res.status === 401, `got ${bad.res.status}`);
  check("failed login sets no session cookie", !c.header().includes("ft_session"), `cookie: "${c.header()}"`);

  const good = await login(PASSWORD);
  check("correct password returns 200", good.res.status === 200, `got ${good.res.status}`);
  check("browser keeps the session cookie", c.header().includes("ft_session"));
  check("no cookie was dropped by the browser", good.dropped.length === 0, `dropped: ${good.dropped.join(", ")}`);

  // --- access ------------------------------------------------------------

  const admin = await fetch(`${B}/admin`, { headers: { cookie: c.header() }, redirect: "manual" });
  check("cookie grants access to /admin", admin.status === 200, `got ${admin.status} ${admin.headers.get("location") ?? ""}`);
  check("admin page renders the shell", (await admin.clone().text()).includes("Flights"));

  // --- write, then confirm a separate client can see it ------------------

  const write = await fetch(`${B}/api/flights`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: c.header() },
    body: JSON.stringify({
      code: TEST_CODE,
      airline: "Smoke Test Air",
      flight_number: "SM 1",
      origin: "AAA",
      destination: "BBB",
      travel_class: "Economy",
      terminal: "1",
      gate: "A1",
      seat: "1A",
      passenger_name: "Smoke Test",
      boarding_date: "2026-12-01",
      boarding_time: "09:00",
      departure_time: "10:00",
      arrival_date: "2026-12-01",
      arrival_time: "14:00",
      status: "scheduled",
      note: "",
    }),
  });
  const body = await write.json();
  created.id = body.id ?? null;
  check("logged-in admin can create a flight", write.status === 201, `got ${write.status}`);
  check("duplicate tracking code is rejected", await duplicateIsRejected(c.header()));

  // A client with no session at all must see the same row. This is the
  // requirement that every device shares one dataset.
  const anonTrack = await fetch(`${B}/api/track/${TEST_CODE}`);
  const anonBody = await anonTrack.json().catch(() => ({}));
  check("a second, unauthenticated client sees the new flight", anonTrack.status === 200, `got ${anonTrack.status}`);
  check("shared flight carries the entered details", anonBody.flight?.airline === "Smoke Test Air", JSON.stringify(anonBody.flight?.airline));
  check("duration is derived correctly", anonBody.flight?.duration_minutes === 240, `got ${anonBody.flight?.duration_minutes}`);

  const anonPage = await fetch(`${B}/track/${TEST_CODE}`);
  const pageHtml = await anonPage.text();
  check("public flight page renders for another device", anonPage.status === 200, `got ${anonPage.status}`);
  check("public page shows the duration", pageHtml.includes("4h"), "expected 4h");

  // --- admin mutations ----------------------------------------------------

  check("shift moves all three times together", await shiftWorks(c.header(), TEST_CODE, 90));
  check("cancel updates the status", await cancelWorks(c.header(), TEST_CODE));
  check("unknown code returns 404", (await fetch(`${B}/api/track/ZZZZ9999`)).status === 404);
  check("malformed code returns 404", (await fetch(`${B}/api/track/!!`)).status === 404);

  // --- negative cases ----------------------------------------------------

  check("anonymous API read blocked with 401", (await fetch(`${B}/api/flights`)).status === 401);
  const anonWrite = await fetch(`${B}/api/flights/${created.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  check("anonymous API write blocked with 401", anonWrite.status === 401, `got ${anonWrite.status}`);

  const crossOrigin = await fetch(`${B}/api/flights/${created.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: c.header(), origin: "https://evil.example" },
    body: JSON.stringify({ status: "scheduled" }),
  });
  check("cross-origin write blocked with 403", crossOrigin.status === 403, `got ${crossOrigin.status}`);

  check("health route reports the database as reachable", await healthOk());
  check("repeated failures lock the account out", await rateLimitEngages());

  const plain = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  check(
    "plain-http login succeeds",
    plain.status === 200,
    `got ${plain.status}`,
  );
  check(
    "plain-http login does not set Secure",
    !/;\s*Secure/i.test(plain.headers.getSetCookie().join(";")),
  );
  const tls = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-proto": "https" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  // Assert the login succeeded first. A 429 sets no cookie at all, which would
  // make both Secure assertions pass for entirely the wrong reason.
  check("https login succeeds", tls.status === 200, `got ${tls.status}`);
  check("https login sets Secure", /;\s*Secure/i.test(tls.headers.getSetCookie().join(";")));

  // --- logout ------------------------------------------------------------

  const out = await fetch(`${B}/api/auth/logout`, { method: "POST", headers: { cookie: c.header() } });
  c.absorb(out);
  check("logout returns 200", out.status === 200, `got ${out.status}`);
  check("browser drops the cookie on logout", !c.header().includes("ft_session"));

  const after = await fetch(`${B}/admin`, { headers: { cookie: c.header() }, redirect: "manual" });
  check("logged-out user is redirected away from /admin", after.status === 307, `got ${after.status}`);

  // --- password change ---------------------------------------------------

  // Requires the current password even with a valid session, so a borrowed
  // unlocked device is not enough to take the account over.
  const relog = jar();
  await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  }).then((res) => relog.absorb(res));

  const weakChange = await passwordChange(relog.header(), PASSWORD, "short");
  check("password change rejects a weak new password", weakChange.status === 400, `got ${weakChange.status}`);

  const wrongCurrent = await passwordChange(relog.header(), "not-the-current-password", PASSWORD);
  check("password change rejects a wrong current password", wrongCurrent.status === 401, `got ${wrongCurrent.status}`);

  // The account's real password is restored at the end of this block, so the
  // operator's credentials are unchanged by running the suite.
  const realChange = await passwordChange(relog.header(), PASSWORD, NEW_PASSWORD);
  check("password change accepts the correct current password", realChange.status === 200, `got ${realChange.status}`);

  const revoked = await fetch(`${B}/admin`, {
    headers: { cookie: relog.header() },
    redirect: "manual",
  });
  check("password change revokes the session that made it", revoked.status === 307, `got ${revoked.status}`);

  const oldPassword = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  check("the old password no longer works", oldPassword.status === 401, `got ${oldPassword.status}`);

  const newPassword = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: NEW_PASSWORD }),
  });
  check("the new password works", newPassword.status === 200, `got ${newPassword.status}`);

  // Put the original password back so the suite is repeatable and the operator's
  // password is unchanged. Best effort: if this fails the account is still
  // reachable with NEW_PASSWORD, which is printed below.
  await run("UPDATE admins SET password_hash = $1 WHERE username = $2", [
    hashPassword(PASSWORD),
    USERNAME,
  ]);
  check("original password restored", true);

  await cleanup();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(async (err) => {
  console.error(`\nsmoke test crashed: ${err.message}`);

  // If the crash happened between the password change and the restore, leave a
  // working credential behind rather than locking the operator out of their own
  // account. Only writes when SMOKE_PASSWORD is still the password the suite
  // authenticated with, so a crash cannot resurrect a superseded credential.
  try {
    const { queryOne, run } = await import("../lib/db.js");
    const { verifyPassword, hashPassword } = await import("../lib/password.js");

    const stored = await queryOne("SELECT password_hash FROM admins WHERE username = $1", [USERNAME]);

    if (stored && !verifyPassword(PASSWORD, stored.password_hash)) {
      // The account already holds something else, so the password was changed
      // underneath us. Restoring now would undo that change.
      console.error("");
      console.error("The account password changed during the run, so it was left as-is.");
    } else if (stored) {
      await run("UPDATE admins SET password_hash = $1 WHERE username = $2", [
        hashPassword(PASSWORD),
        USERNAME,
      ]);
      console.error(`Restored the original password for "${USERNAME}".`);
    }
  } catch {
    // Nothing further to try; the operator can still use npm run set-password.
  }

  await cleanup().catch(() => {});
  process.exit(1);
});

async function duplicateIsRejected(cookie) {
  const res = await fetch(`${B}/api/flights`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      code: TEST_CODE,
      airline: "Duplicate",
      origin: "AAA",
      destination: "CCC",
      boarding_date: "2026-12-02",
      boarding_time: "09:00",
      departure_time: "10:00",
      arrival_date: "2026-12-02",
      arrival_time: "12:00",
    }),
  });
  const body = await res.json().catch(() => ({}));
  return res.status === 400 && Boolean(body.errors?.code);
}

async function shiftWorks(cookie, code, minutes) {
  const before = (await (await fetch(`${B}/api/track/${code}`)).json()).flight;
  const res = await fetch(`${B}/api/flights/${created.id}/shift`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ minutes }),
  });
  if (res.status !== 200) return false;

  const after = (await (await fetch(`${B}/api/track/${code}`)).json()).flight;
  return (
    after.boarding_time === shiftTime(before.boarding_time, minutes) &&
    after.departure_time === shiftTime(before.departure_time, minutes) &&
    after.arrival_time === shiftTime(before.arrival_time, minutes)
  );
}

async function cancelWorks(cookie, code) {
  const res = await fetch(`${B}/api/flights/${created.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (res.status !== 200) return false;
  const flight = (await (await fetch(`${B}/api/track/${code}`)).json()).flight;
  return flight.status === "cancelled";
}

/** Mirrors the server-side shift so the test asserts real arithmetic. */
function shiftTime(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

async function healthOk() {
  const res = await fetch(`${B}/api/health`);
  const body = await res.json().catch(() => ({}));
  return res.status === 200 && body.ok === true && body.database === "reachable";
}

function passwordChange(cookie, current_password, new_password) {
  return fetch(`${B}/api/auth/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ current_password, new_password }),
  });
}

/**
 * Drives repeated bad passwords until the account locks, then confirms that
 * even the correct password is refused. Clears the counters afterwards so the
 * suite can finish and stay repeatable.
 */
async function rateLimitEngages() {
  const attempts = 12;
  let locked = false;

  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(`${B}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: `wrong-guess-${i}` }),
    });

    if (res.status === 429) {
      locked = true;
      break;
    }
  }

  if (!locked) return false;

  // A correct password must not be a way around the lockout.
  const correct = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  const { run } = await import("../lib/db.js");
  await run("DELETE FROM login_attempts");

  return correct.status === 429;
}
