import { MediaImage } from "@/components/media-image"
import { FileIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Attachment } from "@/types/community.api.type"

interface Props {
  attachments: Attachment[]
  className?: string
}

/**
 * `media_ref` may be a `blob:` object URL on a freshly-created mock post, or a
 * MinIO URL in live mode. `MediaImage` leaves blobs alone and points live art
 * at MinIO rather than the Next optimizer.
 */
export function AttachmentGallery({ attachments, className }: Props) {
  const ready = attachments.filter((item) => item.status !== "FAILED")
  if (ready.length === 0) return null

  return (
    <div
      className={cn(
        "grid gap-2",
        ready.length > 1 ? "grid-cols-2" : "grid-cols-1",
        className
      )}
    >
      {ready.map((attachment) => (
        <AttachmentTile key={attachment.id} attachment={attachment} />
      ))}
    </div>
  )
}

function AttachmentTile({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "IMAGE") {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        <MediaImage
          src={attachment.media_ref}
          alt=""
          fill
          className="object-cover"
        />
      </div>
    )
  }

  if (attachment.kind === "VIDEO") {
    return (
      <video
        src={attachment.media_ref}
        controls
        className="aspect-video w-full rounded-lg bg-black"
      />
    )
  }

  return (
    <a
      href={attachment.media_ref}
      download
      onClick={(event) => event.stopPropagation()}
      className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
    >
      <FileIcon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">Attached file</span>
    </a>
  )
}
