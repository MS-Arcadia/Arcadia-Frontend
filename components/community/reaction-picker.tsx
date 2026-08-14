"use client"

import { SmilePlus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSetReactionMutation } from "@/queries/community"
import { useAuthStore } from "@/stores/auth.store"
import { useCommunityReactionsStore } from "@/stores/community-reactions.store"
import { cn } from "@/lib/utils"
import { REACTION_EMOJI } from "@/types/community.api.type"

interface Props {
  postId: string
  reactions: Record<string, number>
  className?: string
}

/**
 * Counts already on the post sit next to a single picker. Opening the picker
 * is how a new emoji is chosen — lining all twelve up on every card crowded
 * the footer and hid which reactions had actually been used.
 *
 * Signed-out visitors see the counts. Reacting is a write, so the picker stays
 * off until there is a session — a click that 401s is worse than no click.
 */
export function ReactionPicker({ postId, reactions, className }: Props) {
  const signedIn = useAuthStore((state) => state.userId !== null)
  const myReaction = useCommunityReactionsStore(
    (state) => state.myReactions[postId] ?? null
  )
  const setMyReaction = useCommunityReactionsStore((state) => state.setReaction)
  const mutation = useSetReactionMutation(postId)

  const given = REACTION_EMOJI.filter((emoji) => (reactions[emoji] ?? 0) > 0)

  function pick(event: React.SyntheticEvent, emoji: string) {
    event.preventDefault()
    event.stopPropagation()
    if (!signedIn || mutation.isPending) return
    const alreadyActive = myReaction === emoji
    mutation.mutate(
      { emoji, alreadyActive },
      {
        onSuccess: (summary) => setMyReaction(postId, summary.my_reaction),
      }
    )
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {given.map((emoji) => {
        const count = reactions[emoji] ?? 0
        const active = signedIn && myReaction === emoji
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={signedIn ? active : undefined}
            aria-label={`${emoji} ${count}`}
            disabled={!signedIn || mutation.isPending}
            onClick={(event) => pick(event, emoji)}
            className={cn(
              "inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs tabular transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              active
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground",
              signedIn &&
                !active &&
                "hover:border-foreground/25 hover:text-foreground"
            )}
          >
            <span aria-hidden>{emoji}</span>
            {count}
          </button>
        )
      })}

      {signedIn ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={mutation.isPending}
            render={
              <button
                type="button"
                aria-label="Add a reaction"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              />
            }
          >
            <SmilePlus className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 min-w-52 p-1.5">
            <div className="grid grid-cols-6 gap-0.5">
              {REACTION_EMOJI.map((emoji) => (
                <DropdownMenuItem
                  key={emoji}
                  aria-label={`React with ${emoji}`}
                  className={cn(
                    "size-8 justify-center p-0 text-base",
                    myReaction === emoji && "bg-primary/15"
                  )}
                  onClick={(event) => pick(event, emoji)}
                >
                  {emoji}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
