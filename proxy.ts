import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const CHALLENGE = {
  status: 401,
  headers: { "WWW-Authenticate": 'Basic realm="Builder Radar", charset="UTF-8"' }
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

export function proxy(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return new NextResponse("Admin access is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return new NextResponse("Authentication required.", CHALLENGE);
  }

  const supplied = decodeCredentials(authorization);
  if (!supplied) {
    return new NextResponse("Authentication required.", CHALLENGE);
  }

  // Evaluate both comparisons unconditionally so failure timing does not
  // reveal which half of the credential pair was wrong.
  const usernameOk = matches(supplied.username, username);
  const passwordOk = matches(supplied.password, password);
  if (usernameOk && passwordOk) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", CHALLENGE);
}

export const config = { matcher: ["/admin/:path*"] };
