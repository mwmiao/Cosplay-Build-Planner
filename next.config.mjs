const isDev = process.env.NODE_ENV !== "production";
// Secure cookies (and so HSTS) only make sense when the app is served over https.
const appUrl = process.env.APP_URL?.trim() ?? "";
const https = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : appUrl.startsWith("https://");

// Inline scripts/styles stay allowed (Next.js hydration data, the theme script,
// Tailwind width styles); everything else is limited to this site. img-src
// allows https: because admins see poster images from event sources.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // src/instrumentation.ts starts the background jobs (guest cleanup, events check).
    instrumentationHook: true,
    serverComponentsExternalPackages: ["sharp", "@prisma/client"],
    // Project imports send the JSON file to a server action (files up to 5 MB).
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
