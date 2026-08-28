import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return new NextResponse("Admin access is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    const suppliedUsername = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    if (suppliedUsername === username && suppliedPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Builder Radar"' }
  });
}

export const config = { matcher: ["/admin/:path*"] };
