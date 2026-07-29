import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The compiler handles memoisation, so nothing here hand-rolls
  // useMemo/useCallback to fight re-renders.
  reactCompiler: true,
  images: {
    // Game art comes from the media service, which signs its own download URLs.
    // Locally that is the compose stack; in production it is whatever the
    // gateway fronts.
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8084" },
      { protocol: "http", hostname: "localhost", port: "9000" },
    ],
  },
}

export default nextConfig
