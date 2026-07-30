"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { FileIcon, Loader2, Paperclip, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useGamesQuery } from "@/queries/catalog"
import { useCreatePostMutation } from "@/queries/community"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselects the game — the current `?game=` on the page this composer
   *  opened from, if there is one. Still changeable: Explore has no fixed
   *  game, so a default is all this can promise. */
  defaultGameId?: string
}

export function PostComposer({ open, onOpenChange, defaultGameId }: Props) {
  const { data: games } = useGamesQuery({ limit: 200 })
  const create = useCreatePostMutation()

  const [gameId, setGameId] = useState(defaultGameId ?? "")
  const [body, setBody] = useState("")
  const [spoiler, setSpoiler] = useState(false)
  const [tags, setTags] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const gameOptions = games?.items ?? []
  const canSubmit =
    Boolean(gameId) && (body.trim().length > 0 || files.length > 0)

  function reset() {
    setGameId(defaultGameId ?? "")
    setBody("")
    setSpoiler(false)
    setTags("")
    setFiles([])
  }

  function handleSubmit() {
    if (!canSubmit) return
    create.mutate(
      {
        game_id: gameId,
        body: body.trim() || undefined,
        spoiler,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        files,
      },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New post</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="composer-game" className="text-xs">
              Game
            </Label>
            <Select
              value={gameId}
              onValueChange={(value) => setGameId(value ?? "")}
            >
              <SelectTrigger id="composer-game" className="w-full">
                <SelectValue placeholder="Which game is this about?" />
              </SelectTrigger>
              <SelectContent>
                {gameOptions.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="composer-body" className="text-xs">
              Post
            </Label>
            <Textarea
              id="composer-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share something with the community..."
              className="min-h-28"
              maxLength={5000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="composer-tags" className="text-xs">
              Tags
            </Label>
            <Input
              id="composer-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="comma, separated, tags"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.zip"
              className="hidden"
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? [])
                setFiles((prev) => [...prev, ...picked])
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-3.5" />
              Attach
            </Button>

            <button
              type="button"
              aria-pressed={spoiler}
              onClick={() => setSpoiler((prev) => !prev)}
              className={cn(
                "min-h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
                spoiler
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
              )}
            >
              Mark as spoiler
            </button>
          </div>

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {file.type.startsWith("image/") ? (
                    <Image
                      src={URL.createObjectURL(file)}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <FileIcon
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="absolute inset-e-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-background/80 text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={!canSubmit || create.isPending}
            onClick={handleSubmit}
          >
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
