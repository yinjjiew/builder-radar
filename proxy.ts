import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * The whole site sits behind HTTP basic auth while the idea is confidential.
 *
 * There are two tiers. Site credentials open every page and are the ones to hand
 * out; admin credentials open the same pages *and* `/admin`, where the directory
 * can be changed. Both challenges use one realm so a browser holding admin
 * credentials is not asked twice.
 *
 * `/api/*` is deliberately outside this gate. Those routes carry their own bearer
 * check against `CRON_SECRET`, and adding basic auth on top would break Vercel's
 * scheduled calls, which cannot present a username and password.
 */
const REALM = 'Basic realm="Builder Radar", charset="UTF-8"';

const CHALLENGE = {
  status: 401,
  headers: {
    "WWW-Authenticate": REALM,
    // Nothing behind the gate should ever be cached by a proxy or indexed.
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow"
  }
} as const;

/**
 * Digest first so the comparison is over fixed-length buffers: timingSafeEqual
 * throws on length mismatch, which would otherwise leak credential length.
 */
function matches(supplied: string, expected: string) {
  const a = createHash("sha256").update(supplied, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function decodeCredentials(header: string) {
  try {
    // TextDecoder rather than atob: passwords may contain non-Latin-1 characters.
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.from(header.slice(6), "base64")
    );
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

type Credential = { username: string; password: string };

function credential(userKey: string, passKey: string): Credential | null {
  const username = process.env[userKey];
  const password = process.env[passKey];
  if (!username || !password) return null;
  return { username, password };
}

function accepts(supplied: Credential, allowed: Credential[]) {
  // Every pair is checked without short-circuiting so failure timing does not
  // reveal which credential, or which half of it, was wrong.
  let ok = false;
  for (const candidate of allowed) {
    const usernameOk = matches(supplied.username, candidate.username);
    const passwordOk = matches(supplied.password, candidate.password);
    if (usernameOk && passwordOk) ok = true;
  }
  return ok;
}

export function proxy(request: NextRequest) {
  const admin = credential("ADMIN_USERNAME", "ADMIN_PASSWORD");
  const site = credential("SITE_USERNAME", "SITE_PASSWORD");

  const isAdminArea = request.nextUrl.pathname.startsWith("/admin");
  // Admin credentials also open the public pages, so one login covers the site.
  const allowed = isAdminArea ? [admin] : [site, admin];
  const usable = allowed.filter((entry): entry is Credential => entry !== null);

  if (!usable.length) {
    // Fail closed. A missing environment variable must never be the reason a
    // confidential site becomes readable.
    return new NextResponse(
      isAdminArea
        ? "Admin access is not configured."
        : "Site access is not configured. Set SITE_USERNAME and SITE_PASSWORD.",
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return new NextResponse("Authentication required.", CHALLENGE);
  }

  const supplied = decodeCredentials(authorization);
  if (!supplied || !accepts(supplied, usable)) {
    return new NextResponse("Authentication required.", CHALLENGE);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Everything except the API routes, which authenticate with CRON_SECRET, and
  // the build assets, which carry no directory data.
  matcher: ["/((?!api/|_next/static/|_next/image/|favicon\\.ico$).*)"]
};
