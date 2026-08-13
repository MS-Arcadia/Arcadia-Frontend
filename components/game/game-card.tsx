import Image from "next/image"
import Link from "next/link"
import { CalendarClock, Check } from "lucide-react"

import { PriceTag } from "@/components/game/price-tag"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/datetime"
import { cn } from "@/lib/utils"
import type { Game } from "@/types/catalog.api.type"

interface Props {
  game: Game
  owned?: boolean
  priority?: boolean
  /** Where the card links. The public catalogue uses `/browse`, whose detail page
   *  offers an account rather than an acquire panel; the signed-in store uses
   *  `/games`, which is behind the auth guard. */
  basePath?: "/games" | "/browse"
}

function cover(game: Game): string | null {
  const art = game.media.find((item) => item.kind === "COVER") ?? game.media[0]
  return art?.media_ref ?? null
}

export function GameCard({
  game,
  owned = false,
  priority = false,
  basePath = "/games",
}: Props) {
  const art = cover(game)
  const preorder = game.state === "PREORDER"

  return (
    <Link
      href={`${basePath}/${game.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-3xl text-muted-foreground/40">
            {game.title.at(0)}
          </div>
        )}

        {/* A wash from the bottom so a title on pale cover art stays readable
            without a solid bar over the picture. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent"
        />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {preorder && (
            <Badge className="gap-1 border-brand-sky/25 bg-brand-sky/15 text-brand-sky">
              <CalendarClock className="size-3" />
              Pre-order
            </Badge>
          )}
          {owned && (
            <Badge className="ms-auto gap-1 border-border bg-background/80 text-foreground backdrop-blur">
              <Check className="size-3" />
              In library
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 text-[0.95rem] font-semibold text-foreground">
          {game.title}
        </h3>

        <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
          {game.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {game.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="rounded bg-muted/60 px-1.5 py-0.5 text-[0.7rem] text-muted-foreground/80"
            >
              {genre}
            </span>
          ))}
        </div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <PriceTag game={game} />
          {preorder && game.release_at && (
            <span className={cn("text-[0.7rem] text-muted-foreground/70")}>
              {formatDate(game.release_at)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
