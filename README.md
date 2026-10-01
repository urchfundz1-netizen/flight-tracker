# Flight Tracker

A flight tracking service. Passengers enter a tracking code and see the airline,
travel class, terminal, boarding date and time, and how long the flight takes.
Staff sign in to a private admin area to add flights, shift schedules, and
cancel flights.

Next.js 16 (App Router) and React 19, with Postgres via Neon.

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in DATABASE_URL
npm run create-admin           # needs ADMIN_PASSWORD set
npm run dev
```

`npm run create-admin` refuses to run without `ADMIN_PASSWORD`, and rejects
weak or guessable values. There is no default password anywhere in the code.

### Commands

| Command                | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Dev server                                       |
| `npm run build`        | Production build                                 |
| `npm start`            | Serve the production build                       |
| `npm run lint`         | ESLint                                           |
| `npm run migrate`      | Apply pending schema migrations                  |
| `npm run create-admin` | Create the admin account (needs a password)      |
| `npm run set-password` | Change an admin password, revoking sessions      |
| `npm run smoke`        | Auth and data-visibility test against a server   |

## Data

All flight data lives in one Postgres database, which is what makes it visible
on every device. There is no per-device state anywhere: every request reads and
writes the same rows, so a flight added on your laptop is immediately visible
from your phone.

The admin area is guarded on every request. `proxy.js` verifies the session
token against the database before any admin page renders, and every API route
re-checks it before writing. A page never renders for a missing or expired
session, so signing out on one device does not leave a cached admin page usable
on another.

### Database

Use the **pooled** connection string from Neon. The driver is stateless HTTP, so
there is no connection pool to configure and nothing to keep alive between
requests.

Schema changes live in `lib/db.js` as a numbered list, applied once each and
recorded in `schema_migrations`. The app migrates itself on the first query of a
cold start, so there is no separate deploy step. `npm run migrate` exists to run
the same thing on demand, which is useful for checking the schema before the app
has ever run, or to see a migration error on its own instead of inside a request
log.

Two details are worth knowing if you edit that list:

- Statements are listed individually rather than stored as one string, so they
  can be sent as separate queries inside a single transaction. Splitting SQL on
  semicolons breaks the first time a statement contains one inside a literal.
- The advisory lock is transaction-scoped (`pg_advisory_xact_lock`), not
  session-scoped. The driver is stateless HTTP, so a session lock taken by one
  request is already gone by the next one and would provide no mutual exclusion
  at all.

### Authentication

Passwords are hashed with scrypt and a per-password salt, then compared in
constant time. A successful login creates a row in `sessions` and sets an
httpOnly, SameSite=Lax cookie that expires after 7 days.

The cookie's `Secure` flag is derived from the request's own protocol
(`x-forwarded-proto`, then the request URL) rather than from `NODE_ENV`.
Inferring it from `NODE_ENV` marks the cookie Secure on a production build
served over plain http, which makes the browser discard it and sends you back
to the login page even though the password was right.

Failed sign-ins are rate limited against a table, not an in-memory counter: an
in-memory counter is per-instance and therefore meaningless behind a serverless
load balancer. Both the client address and the username are tracked separately,
so one host cannot spray many usernames and one account cannot be attacked from
a botnet. Eight failures locks the key out for fifteen minutes.

State-changing admin routes also compare the `Origin` header against the request
host. `SameSite=Lax` is the primary defence; this is a cheap second layer for the
cases it does not cover.

Changing a password requires the current one, either through
**Admin → Account** in the browser or `npm run set-password` on the server, and
revokes every existing session.

### Flight duration

Duration is derived at read time from the departure and arrival timestamps
rather than stored, so it can never drift out of sync with the schedule. Dates
and times are stored as `TEXT` in `YYYY-MM-DD` and `HH:MM` form: a boarding
time is a wall-clock time at that airport, not a global instant, so storing it
as a Postgres `DATE`/`TIMESTAMP` would introduce timezone ambiguity for no
benefit.

### Shifting a flight time

`POST /api/flights/[id]/shift` with `{ "minutes": 90 }` moves boarding,
departure, and arrival together, rolling the date forward when a shift crosses
midnight. Negative values bring the flight forward. The server rejects shifts
over 48 hours and any shift that would make arrival precede departure.

## Layout

```
app/
  page.js                     public tracking form
  track/[code]/page.js        flight details from a tracking code
  admin/login/page.js         sign-in
  admin/page.js               flight list with cancel / shift / edit
  admin/account/page.js       change password
  admin/flights/new/page.js   add a flight
  admin/flights/[id]/page.js  edit a flight
  api/auth/login/             create a session, rate limited
  api/auth/logout/            destroy a session
  api/auth/password/          change password, revokes sessions
  api/flights/                admin list and create
  api/flights/[id]/           admin read and update
  api/flights/[id]/status/    cancel or reinstate
  api/flights/[id]/shift/     move every time by N minutes
  api/track/[code]/           public lookup, 404 when unknown
  api/health/                 liveness and database reachability
lib/
  db.js                       connection, migrations, query helpers
  auth.js                     sessions and cookie handling
  password.js                 scrypt hashing and strength checks
  flights.js                  validation and flight queries
  rate-limit.js               shared-store rate limiting
  api-guard.js                session, same-origin, and error handling
  require-admin-page.js       page-level admin guard
proxy.js                      redirects unauthenticated /admin traffic
scripts/
  migrate.js                  apply pending migrations
  create-admin.js             creates the first admin
  set-password.js             rotates a password
  smoke.js                    auth and data-visibility test
```

## Responsive layout

Mobile-first. The admin flight table collapses into stacked cards below 760px,
with each cell labelled from its `data-label` attribute, so nothing is lost and
there is no horizontal scrolling on a phone. Form grids drop from three columns
to two to one, and inputs are 16px to stop iOS zooming on focus.

## Testing

```bash
npm start
SMOKE_PASSWORD='your-passphrase' npm run smoke
```

The smoke test applies real browser cookie rules, which is what caught the
`Secure` flag bug. It also verifies the shared-data requirement directly: it
writes a flight as one client, then reads it back with a second client that
holds no session at all. It covers the rate-limit lockout, the cross-origin
write refusal, and the password-change flow, and it creates and removes its own
test flight.

The password-change check sets a throwaway password and then restores the
original, so a passing run leaves the admin's password unchanged.

Run it against a disposable environment. It is thorough rather than polite, and
it will lock the account out several times on the way.

## Deploying

1. Create a free Neon project. Copy the **pooled** connection string.
2. Set `DATABASE_URL` in your host's environment variables.
3. Run `npm run create-admin` once, locally or in a deploy shell, with
   `ADMIN_PASSWORD` set.
4. Deploy.

The schema is created automatically on first connection and tracked in
`schema_migrations`, so there is no separate migration step on deploy. The
cookie sets `secure` automatically when served over HTTPS, so no extra
configuration is needed behind Vercel's TLS.
