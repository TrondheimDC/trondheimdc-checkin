import type { NextConfig } from "next"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // proxy.ts runs on /api/smooth-print/apks; Next buffers the body and cuts it at 10 MB by default.
  experimental: {
    proxyClientMaxBodySize: "300mb",
  },
  // Keep Drizzle SQL migrations in the standalone trace (also copied in Dockerfile).
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  async headers() {
    return [
      {
        source: "/templates/badge.lbx",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          { key: "Content-Disposition", value: 'attachment; filename="badge.lbx"' },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ]
  },
}

export default nextConfig
