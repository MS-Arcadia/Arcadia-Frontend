import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Traces the exact files the server needs into `.next/standalone`, so the
  // runtime image can be `node server.js` over a copied tree instead of a full
  // `node_modules`. It is what makes the third Docker stage small, and the
  // Dockerfile's COPY steps depend on it existing.
  output: "standalone",

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
      { protocol: "http", hostname: "media-service", port: "8084" },
      { protocol: "http", hostname: "minio", port: "9000" },
    ],
  },
}

export default nextConfig
