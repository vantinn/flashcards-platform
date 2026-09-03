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
};

export default nextConfig;
