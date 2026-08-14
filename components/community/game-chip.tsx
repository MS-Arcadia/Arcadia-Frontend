"use client"

import Link from "next/link"
import { MediaImage } from "@/components/media-image"

import { useGameQuery } from "@/queries/catalog"
import { gameArt } from "@/lib/game-art"
import { cn } from "@/lib/utils"

interface Props {
  gameId: string
  className?: string
}

/**
 * `Post.game_id` is a bare id — community-service does not denormalize the
 * title. Catalog already answers that lookup, and React Query dedupes it
 * across a feed of posts about the same game.
 */
export function GameChip({ gameId, className }: Props) {
  const { data: game } = useGameQuery(gameId)
  if (!game) return null

  const art = gameArt(game.media)

  return (
    <Link
      href={`/community?game=${gameId}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline",
        className
      )}
    >
      <span className="relative size-7 shrink-0 overflow-hidden rounded-md bg-muted">
        {art ? (
          <MediaImage
            src={art.media_ref}
            alt=""
            fill
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-full items-center justify-center font-display text-xs text-muted-foreground"
          >
            {game.title.at(0)}
          </span>
        )}
      </span>
      <span className="truncate">{game.title}</span>
    </Link>
  )
}
