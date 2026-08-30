import { NextResponse } from "next/server";

/**
 * Keeps a correlation ID on protected page responses. Authentication and RBAC
 * remain in the server-side data access layer, where the signed session can be
 * verified against the database rather than trusted from a proxy hint.
 */
export function proxy() {
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", crypto.randomUUID());
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/wallet/:path*",
    "/profile/:path*",
  ],
};
