import type { NextConfig } from "next";

const securityHeaders = [
  // Prevents the browser from guessing content types (e.g. treating a
  // user-controlled upload as executable script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // This app never embeds its own pages in a frame — blocks clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Third-party sites get no referrer at all; same-origin navigations
  // still get the full path for analytics/back-button UX.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (server + only the
  // node_modules it actually needs) — what the Dockerfile copies into the
  // production image instead of shipping the full node_modules tree.
  // Skipped on Vercel: its own build pipeline is incompatible with
  // standalone output (breaks file tracing) and doesn't need it anyway.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  // Removes the "X-Powered-By: Next.js" response header — free
  // reconnaissance for an attacker (framework + version fingerprinting)
  // with no benefit to real users.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Proxies the browser's same-origin /api/v1/* calls through to the real
  // backend (see lib/api-client.ts). This is what makes the httpOnly auth
  // cookies genuinely first-party: the frontend (Vercel) and backend
  // (Railway) are different registrable domains, so a cookie set directly
  // by a cross-site response is invisible to this app's own proxy.ts /
  // Server Components no matter its SameSite/Secure attributes — cookies
  // are scoped by domain, not by CORS or fetch credentials mode. Routing
  // browser requests through this app's own origin first sidesteps that
  // entirely, and is also more robust than SameSite=None cross-site cookies
  // against browsers that restrict third-party cookies by default.
  async rewrites() {
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1").replace(
      /\/api\/v1\/?$/,
      "",
    );
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
