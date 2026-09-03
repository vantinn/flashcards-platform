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

// The whole product is authenticated-only: "public" only ever means visible
// to any signed-in user, never to an anonymous visitor. /sets/:id (viewing)
// and /explore (browsing public sets) are included here for that reason —
// the backend's findOneVisibleTo/search still apply the private/unlisted/
// public rules on top, once the caller is known to be signed in.
export const config = {
  matcher: [
    "/dashboard",
    "/explore",
    "/sets",
    "/sets/create",
    "/sets/:id",
    "/sets/:id/edit",
    "/sets/:id/settings",
    "/sets/:id/study",
    "/sets/:id/cram",
    "/sets/:id/deep-learning",
    "/profile",
    "/onboarding",
  ],
};
