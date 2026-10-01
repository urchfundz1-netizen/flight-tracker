import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Rejects cross-origin writes.
 *
 * SameSite=Lax already stops the session cookie being sent on most cross-site
 * requests, but that is a single layer and does not cover every case. Comparing
 * the Origin header against the request host is cheap and closes the gap.
 *
 * Only methods that change state are checked; a GET carries no CSRF risk here.
 *
 * An absent Origin is allowed through. Same-origin GET-originated navigations
 * omit it in some browsers, so demanding it would break the app while still
 * not being the check that matters. A present-but-mismatched Origin is refused.
 */
export function requireSameOrigin(request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const origin = request.headers.get("origin");
  if (!origin) return null;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  }

  let requestHost;
  try {
    // Behind Vercel the internal URL can carry a different host than the public
    // one, so x-forwarded-host is preferred when present.
    requestHost =
      request.headers.get("x-forwarded-host") || new URL(request.url).host;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (originHost !== requestHost) {
    return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  }

  return null;
}

export function badRequest(errors) {
  return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
}

/**
 * Wraps an admin route handler with the session check, the same-origin check,
 * and a 503 for unexpected failures so a database problem does not surface as
 * a stack trace in the browser.
 *
 * The resolved admin is passed to the handler, so routes do not repeat the
 * session lookup.
 */
export async function withAdmin(request, handler) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });
  }

  const crossOrigin = requireSameOrigin(request);
  if (crossOrigin) return crossOrigin;

  try {
    return await handler(admin);
  } catch (error) {
    console.error("[api] unhandled error:", error);
    return NextResponse.json(
      { error: "The database is not reachable right now. Please try again shortly." },
      { status: 503 },
    );
  }
}
