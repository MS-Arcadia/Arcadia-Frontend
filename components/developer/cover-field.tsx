"use client"

import { useEffect, useMemo, useRef } from "react"
import { ImagePlus, X } from "lucide-react"

import { MediaImage } from "@/components/media-image"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

interface Props {
  id: string
  file: File | null
  onFileChange: (file: File | null) => void
  error?: string
  /** Existing cover already on the game, shown until a new file is picked. */
  existingUrl?: string | null
}

export function CoverField({
  id,
  file,
  onFileChange,
  error,
  existingUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  )

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const preview = objectUrl ?? existingUrl ?? null

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Cover</Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0] ?? null
          onFileChange(picked)
          event.target.value = ""
        }}
      />
      {preview ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
          <MediaImage src={preview} alt="" fill className="object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute inset-e-2 top-2 min-h-8"
            onClick={() => inputRef.current?.click()}
          >
            <X className="size-3.5" />
            Change
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <ImagePlus className="size-5" strokeWidth={1.5} />
          Choose a cover image
        </button>
      )}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP or GIF. This is what the store shows.
        </p>
      )}
    </div>
  )
}
