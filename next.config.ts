import type { NextConfig } from "next"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""

const nextConfig: NextConfig = {
  basePath,
  async headers() {
    return [
      {
        source: "/templates/badge.lbx",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ]
  },
}

export default nextConfig
