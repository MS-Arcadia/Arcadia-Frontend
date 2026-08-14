import { publicAssetUrl } from "@/lib/media-url"
import { cn } from "@/lib/utils"

/**
 * A public asset, fetched by the browser from MinIO.
 *
 * `next/image` would proxy the file through this Next process (`/_next/image?url=`).
 * Covers and screenshots are already on MinIO; going through the frontend adds a
 * hop, a host allow-list, and a cache that is not the object store.
 */
interface Props {
  src: string | null | undefined
  alt: string
  className?: string
  /** Stretch to a `relative` parent, the same contract as `next/image` `fill`. */
  fill?: boolean
  width?: number
  height?: number
  priority?: boolean
}

export function MediaImage({
  src,
  alt,
  className,
  fill = false,
  width,
  height,
  priority = false,
}: Props) {
  const url = publicAssetUrl(src)
  if (!url) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote media is served from MinIO, not the Next optimizer
    <img
      src={url}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      className={cn(fill && "absolute inset-0 size-full", className)}
    />
  )
}
