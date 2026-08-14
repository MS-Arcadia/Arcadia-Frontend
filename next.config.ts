import type { NextConfig } from "next"

/**
 * The gateway's own origin, as an `images.remotePatterns` entry.
 *
 * Game art is served by media-service, which builds absolute URLs from its
 * `PUBLIC_BASE_URL` — in production the gateway's origin. `next/image` refuses any
 * host not listed here, so a deployment whose gateway is not in the list renders
 * every cover as a broken image while the API itself looks perfectly healthy.
 *
 * Derived from the API URL the build is already given rather than hard-coded, so
 * moving to another domain does not mean remembering to edit this file too.
 */
function gatewayImagePattern() {
  const raw = process.env.NEXT_PUBLIC_API_URL
  if (!raw) return []
  try {
    const { protocol, hostname, port } = new URL(raw)
    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        port,
      },
    ]
  } catch {
    // A malformed URL is the build's problem, not this file's — the app fails
    // loudly elsewhere, and throwing here would only obscure where.
    return []
  }
}

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
    // Public art is fetched by the browser from MinIO (`MediaImage`), not
    // through `/_next/image`. `unoptimized` keeps any leftover `next/image`
    // from standing up that proxy if a remote src slips back in.
    unoptimized: true,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8084" },
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "media-service", port: "8084" },
      { protocol: "http", hostname: "minio", port: "9000" },
      { protocol: "https", hostname: "minio.arcadia.aptcodegen.online" },
      ...gatewayImagePattern(),
    ],
  },
}

export default nextConfig
