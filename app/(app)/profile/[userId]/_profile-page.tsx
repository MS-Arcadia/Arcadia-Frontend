"use client"

import Image from "next/image"
import Link from "next/link"
import {
  Eye,
  EyeOff,
  Gamepad2,
  MessagesSquare,
  ShoppingBag,
} from "lucide-react"

import { AuthorChip } from "@/components/community/author-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useHideGameMutation,
  useUnhideGameMutation,
  useProfileGamesQuery,
  useProfileItemsQuery,
  useProfileTopPostsQuery,
  usePublicProfileQuery,
} from "@/queries/profile"
import { formatRelative } from "@/lib/datetime"
import { formatMoney, formatNumber } from "@/lib/money"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth.store"
import type { Role } from "@/types/common.api.type"
import type { Game } from "@/types/catalog.api.type"
import type { Post } from "@/types/community.api.type"
import type { MarketItem } from "@/types/marketplace.api.type"
import { gameArt } from "@/lib/game-art"

const ROLE_LABEL: Record<Role, string> = {
  BASIC_USER: "Player",
  DEVELOPER: "Developer",
  SUPPORT: "Support",
  ADMIN: "Administrator",
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.at(0) ?? "")
    .join("")
    .toUpperCase()
}

function cover(game: Game): string | null {
  const art = gameArt(game.media)
  return art?.media_ref ?? null
}

interface Props {
  userId: string
}

export function ProfilePage({ userId }: Props) {
  const me = useAuthStore((state) => state.user)
  const isOwn = me?.user_id === userId

  const { data: profile, isPending, isError } = usePublicProfileQuery(userId)
  const { data: games = [], isPending: gamesPending } =
    useProfileGamesQuery(profile)
  const { data: items = [], isPending: itemsPending } =
    useProfileItemsQuery(profile)
  const { data: posts = [], isPending: postsPending } =
    useProfileTopPostsQuery(userId)

  const hide = useHideGameMutation(userId)
  const unhide = useUnhideGameMutation(userId)

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium">Profile not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          That account may have been removed, or the id is wrong.
        </p>
        <Button
          className="mt-5"
          nativeButton={false}
          render={<Link href="/store" />}
        >
          Back to the store
        </Button>
      </div>
    )
  }

  const role = isOwn ? me?.role : profile.role
  const gameById = new Map(games.map((game) => [game.id, game]))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 0% 0%, color-mix(in oklab, var(--color-brand-magenta) 22%, transparent), transparent 60%), radial-gradient(ellipse 70% 50% at 100% 100%, color-mix(in oklab, var(--color-brand-violet) 18%, transparent), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:gap-8 sm:p-8">
          <div className="relative shrink-0">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 font-display text-3xl font-semibold text-primary ring-1 ring-primary/20 sm:size-28 sm:text-4xl">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={112}
                  height={112}
                  className="size-full object-cover"
                />
              ) : (
                initials(profile.display_name)
              )}
            </div>
            <span
              aria-label={profile.online ? "Online" : "Offline"}
              className={cn(
                "absolute end-1 bottom-1 size-3.5 rounded-full ring-2 ring-card",
                profile.online ? "bg-emerald-500" : "bg-muted-foreground/40"
              )}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {profile.display_name}
              </h1>
              {isOwn && me?.email ? (
                <p className="text-sm text-muted-foreground">{me.email}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {role ? (
                <Badge className="border-primary/25 bg-primary/15 text-primary">
                  {ROLE_LABEL[role]}
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-normal">
                {profile.online ? "Online now" : "Away"}
              </Badge>
              {isOwn ? (
                <Badge variant="secondary" className="font-normal">
                  Your profile
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative grid grid-cols-3 divide-x divide-border border-t border-border">
          <Stat
            icon={Gamepad2}
            label="Games"
            value={formatNumber(profile.owned_games.length)}
          />
          <Stat
            icon={ShoppingBag}
            label="Items"
            value={formatNumber(profile.owned_items.length)}
          />
          <Stat
            icon={MessagesSquare}
            label="Top posts"
            value={formatNumber(posts.length || profile.top_posts.length)}
          />
        </div>
      </header>

      <Shelf
        title="Library"
        hint={
          isOwn
            ? "Games on your public shelf. Hide one and visitors stop seeing it — it stays in your Library."
            : "Games this player keeps on their public shelf."
        }
        empty="No games on this shelf yet."
        pending={gamesPending}
        isEmpty={profile.owned_games.length === 0}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profile.owned_games.map((entry) => {
            const game = gameById.get(entry.game_id)
            if (!game) {
              return (
                <div
                  key={entry.game_id}
                  className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"
                >
                  Game unavailable
                </div>
              )
            }
            const art = cover(game)
            return (
              <article
                key={entry.game_id}
                className={cn(
                  "group relative flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40",
                  // A hidden game is dimmed rather than removed, and only its owner sees
                  // it at all. It used to disappear from here entirely — which is the one
                  // screen that can bring it back, so hiding a game was permanent.
                  entry.hidden && "opacity-60"
                )}
              >
                <Link
                  href={`/games/${game.id}`}
                  className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                >
                  {art ? (
                    <Image
                      src={art}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center font-display text-lg text-muted-foreground/50">
                      {game.title.at(0)}
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/games/${game.id}`}
                    className="line-clamp-1 text-sm font-semibold hover:text-primary"
                  >
                    {game.title}
                  </Link>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {game.genres.slice(0, 2).join(" · ") || "Game"}
                  </p>
                  {isOwn ? (
                    entry.hidden ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ms-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                        disabled={unhide.isPending}
                        onClick={() => unhide.mutate(game.id)}
                      >
                        <Eye className="size-3.5" />
                        Hidden — show again
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ms-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                        disabled={hide.isPending}
                        onClick={() => hide.mutate(game.id)}
                      >
                        <EyeOff className="size-3.5" />
                        Hide from profile
                      </Button>
                    )
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </Shelf>

      <Shelf
        title="Market holdings"
        hint="Tradeable items this player currently holds."
        empty="No market items held."
        pending={itemsPending}
        isEmpty={items.length === 0 && !itemsPending}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item: MarketItem) => (
            <Link
              key={item.id}
              href={`/market/${item.id}`}
              className="flex gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center font-display text-lg text-muted-foreground/50">
                    {item.title.at(0)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-1 text-sm font-semibold">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground tabular">
                  Buy {formatMoney(item.buy_value)} · Sell{" "}
                  {formatMoney(item.sell_value)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Shelf>

      <Shelf
        title="Top posts"
        hint="Highest-feedback posts from community, capped at five."
        empty="No posts yet."
        pending={postsPending}
        isEmpty={posts.length === 0 && !postsPending}
      >
        <div className="space-y-3">
          {posts.map((post: Post, index) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-lg font-semibold text-primary/70 tabular">
                  #{index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2 text-sm leading-relaxed">
                    {post.body || (
                      <span className="text-muted-foreground italic">
                        Attachment post
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <AuthorChip authorId={post.author_id} />
                    {" · "}
                    {formatRelative(post.created_at)}
                    {" · "}
                    <span className="tabular">
                      {formatNumber(post.feedback_score)} feedback
                    </span>
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Shelf>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gamepad2
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-4 sm:flex-row sm:justify-center sm:gap-2.5 sm:py-5">
      <Icon
        className="size-4 text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden
      />
      <p className="font-display text-xl font-semibold tabular sm:text-2xl">
        {value}
      </p>
      <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase sm:text-xs sm:tracking-normal sm:normal-case">
        {label}
      </p>
    </div>
  )
}

function Shelf({
  title,
  hint,
  empty,
  pending,
  isEmpty,
  children,
}: {
  title: string
  hint: string
  empty: string
  pending: boolean
  isEmpty: boolean
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {pending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        children
      )}
    </section>
  )
}
