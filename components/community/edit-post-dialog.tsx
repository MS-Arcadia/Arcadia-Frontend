"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { useEditPostMutation } from "@/queries/community"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/community.api.type"

interface Props {
  post: Post
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Author-only. `useEditPostMutation` takes the same body/spoiler/tags shape
 *  the composer does, minus the game and the attachments — a post's game and
 *  attachments cannot change after it is created. */
export function EditPostDialog({ post, open, onOpenChange }: Props) {
  const edit = useEditPostMutation()
  const [body, setBody] = useState(post.body)
  const [spoiler, setSpoiler] = useState(post.spoiler)
  const [tags, setTags] = useState(post.tags.join(", "))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) {
          setBody(post.body)
          setSpoiler(post.spoiler)
          setTags(post.tags.join(", "))
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-body" className="text-xs">
              Post
            </Label>
            <Textarea
              id="edit-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-28"
              maxLength={5000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-tags" className="text-xs">
              Tags
            </Label>
            <Input
              id="edit-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="comma, separated, tags"
            />
          </div>

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

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={edit.isPending || !body.trim()}
            onClick={() =>
              edit.mutate(
                {
                  id: post.id,
                  body: {
                    body: body.trim(),
                    spoiler,
                    tags: tags
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  },
                },
                { onSuccess: () => onOpenChange(false) }
              )
            }
          >
            {edit.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
