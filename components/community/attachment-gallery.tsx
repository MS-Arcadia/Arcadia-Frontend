import Image from "next/image"
import { FileIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Attachment } from "@/types/community.api.type"

interface Props {
  attachments: Attachment[]
  className?: string
}

/**
 * `media_ref` on a freshly-created post is a real `blob:` object URL (see
 * `services/mocks/db.ts`), which the Next image optimizer cannot fetch
 * server-side — so images render `unoptimized`, which is exactly what a blob
 * URL needs (skip the optimizer route, use the src as-is).
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
        <Image
          src={attachment.media_ref}
          alt=""
          fill
          unoptimized
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
