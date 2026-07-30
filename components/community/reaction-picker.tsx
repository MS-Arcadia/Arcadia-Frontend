"use client"

import { useSetReactionMutation } from "@/queries/community"
import { useCommunityReactionsStore } from "@/stores/community-reactions.store"
import { cn } from "@/lib/utils"
import { REACTION_EMOJI } from "@/types/community.api.type"

interface Props {
  postId: string
  reactions: Record<string, number>
  className?: string
}

/** The closed twelve-emoji row. Each button shows its aggregate count from
 *  the post and toggles on click — a second click on the same emoji clears
 *  it, matching the mock's PUT-is-idempotent semantics. */
export function ReactionPicker({ postId, reactions, className }: Props) {
  const myReaction = useCommunityReactionsStore(
    (state) => state.myReactions[postId] ?? null
  )
  const setMyReaction = useCommunityReactionsStore((state) => state.setReaction)
  const mutation = useSetReactionMutation(postId)

  function handleClick(event: React.MouseEvent, emoji: string) {
    event.preventDefault()
    event.stopPropagation()
    if (mutation.isPending) return
    const alreadyActive = myReaction === emoji
    mutation.mutate(
      { emoji, alreadyActive },
      {
        onSuccess: (summary) => setMyReaction(postId, summary.my_reaction),
      }
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {REACTION_EMOJI.map((emoji) => {
        const count = reactions[emoji] ?? 0
        const active = myReaction === emoji
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={active}
            aria-label={`React with ${emoji}`}
            disabled={mutation.isPending}
            onClick={(event) => handleClick(event, emoji)}
            className={cn(
              "inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              active
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
            )}
          >
            <span aria-hidden>{emoji}</span>
            {count > 0 && <span className="tabular">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
