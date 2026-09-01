import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic auth check only — presence of the cookie, not its validity.
// Real enforcement happens on the NestJS API (global JwtAuthGuard), this
// just avoids flashing protected UI before a client-side redirect would.
export function proxy(request: NextRequest) {
  const hasAccessToken = request.cookies.has("access_token");

  if (!hasAccessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Deliberately excludes /sets/:id (viewing) — public and unlisted sets must
// stay reachable by anonymous visitors coming from /explore; the backend's
// findOneVisibleTo already 404s a private one for them. /sets/:id/study,
// /sets/:id/cram, and /sets/:id/deep-learning are gated because starting a
// session requires an authenticated user.
export const config = {
  matcher: [
    "/dashboard",
    "/sets",
    "/sets/create",
    "/sets/:id/edit",
    "/sets/:id/settings",
    "/sets/:id/study",
    "/sets/:id/cram",
    "/sets/:id/deep-learning",
    "/profile",
  ],
};
