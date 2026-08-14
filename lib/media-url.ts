/**
 * Where a browser should fetch a public asset from.
 *
 * Catalog and marketplace store the media-service download URL
 * (`…/media/v1/media/{id}/content`). Next.js `Image` then pulled that through
 * `/_next/image`, so every cover was served by the frontend process instead of
 * MinIO. Public bytes live in the `arcadia-media` bucket; the object key is
 * the same sharding media-service uses (`object_key_for`), so the id in the
 * stored URL is enough to build the MinIO path without another round trip.
 *
 * Local paths, blob URLs and anything already on the MinIO host are left alone.
 */

const MEDIA_CONTENT = /\/media\/v1\/media\/([^/?#]+)\/content/

const DEFAULT_BUCKET = "arcadia-media"

export function minioPublicOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.port = "9000"
      url.protocol = "http:"
      url.pathname = ""
      return url.origin
    }
    if (url.hostname.startsWith("api.")) {
      url.hostname = `minio.${url.hostname.slice("api.".length)}`
      url.pathname = ""
      return url.origin
    }
    return null
  } catch {
    return null
  }
}

/** Same key media-service writes: first four characters as two path segments. */
export function objectKeyFor(mediaId: string): string {
  const safe = [...mediaId].filter((ch) => /[a-zA-Z0-9_-]/.test(ch)).join("")
  const padded = safe.length < 4 ? safe.padEnd(4, "0") : safe
  return `${padded.slice(0, 2)}/${padded.slice(2, 4)}/${safe || padded}`
}

export function publicAssetUrl(ref: string | null | undefined): string | null {
  if (!ref) return null
  if (
    ref.startsWith("/") ||
    ref.startsWith("blob:") ||
    ref.startsWith("data:")
  ) {
    return ref
  }

  const origin = minioPublicOrigin()
  if (!origin) return ref

  if (ref.startsWith(origin)) return ref

  const match = ref.match(MEDIA_CONTENT)
  if (!match) return ref

  return `${origin}/${DEFAULT_BUCKET}/${objectKeyFor(match[1])}`
}
