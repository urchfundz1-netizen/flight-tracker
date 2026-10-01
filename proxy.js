import { NextResponse } from "next/server";
import { findSessionAdmin, SESSION_COOKIE } from "@/lib/auth";

const PROTECTED = ["/admin"];

/**
 * Gate for the admin area. Runs on the Node runtime in Next 16, so this can
 * verify the session token against the database rather than trusting a cookie
 * that merely exists.
 */
export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const isProtected = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  let admin = null;
  if (isProtected) {
    // A database blip must not lock an admin out of a page they are entitled to
    // see. Treat an unreachable database as "not proven", but fall through to
    // the page-level guard, which reports the problem properly, rather than
    // bouncing to the login page with a misleading message.
    admin = await findSessionAdmin(request.cookies.get(SESSION_COOKIE)?.value).catch((error) => {
      console.error("[proxy] session lookup failed:", error);
      return null;
    });
  }

  if (isProtected && !isLogin && !admin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (isLogin && admin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // /admin/login is included so an already-signed-in visitor is bounced to the
  // dashboard. It must stay reachable when signed out, which is why the handler
  // above exempts that one path from the redirect.
  matcher: ["/admin", "/admin/login", "/admin/account", "/admin/flights/:path*"],
};
