/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Baseline security headers.
   *
   * X-Frame-Options DENY stops any site embedding this one in an iframe, which
   * is the shape of a clickjacking attack against the admin login form: an
   * attacker frames the page and overlays it with their own UI to capture the
   * password someone types into what looks like an unrelated site. Nothing here
   * is ever meant to be embedded, so DENY is correct rather than SAMEORIGIN.
   *
   * nosniff stops a browser guessing a content type other than the one served,
   * which is what turns an uploaded or reflected file into executable script.
   *
   * Deliberately no Content-Security-Policy here. Next.js emits inline scripts
   * and styles for hydration, so a CSP needs either nonces threaded through the
   * render path or 'unsafe-inline', and a misconfigured one silently breaks the
   * app. Not worth the risk without a specific threat to address.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
