import type { NextConfig } from "next"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""

const nextConfig: NextConfig = {
  basePath,
  allowedDevOrigins: ["preview1.t3code.asamsig.com"],
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
