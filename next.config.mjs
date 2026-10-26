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
        ],
      },
    ];
  },
};

export default nextConfig;
