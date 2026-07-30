"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Loader2,
  MessagesSquare,
  Plus,
  Search,
  X,
} from "lucide-react"

import { getExploreFeed, getGameFeed, searchPosts } from "@/api/community"
import { PostCard } from "@/components/community/post-card"
import { PostComposer } from "@/components/community/post-composer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useGameQuery } from "@/queries/catalog"
import { cn } from "@/lib/utils"
import type { CursorPage } from "@/types/common.api.type"
import type { FeedSort, Post } from "@/types/community.api.type"

const SORTS: [FeedSort, string][] = [
  ["newest", "Newest"],
  ["most_viewed", "Most viewed"],
  ["most_reacted", "Most reacted"],
]

const PAGE_SIZE = 20

export function CommunityPage() {
  const searchParams = useSearchParams()
  const gameId = searchParams.get("game")

  const { data: game } = useGameQuery(gameId ?? "")

  const [sort, setSort] = useState<FeedSort>("newest")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [composerOpen, setComposerOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const mode: "search" | "game" | "explore" = searchQuery
    ? "search"
    : gameId
      ? "game"
      : "explore"

  // `useInfiniteQuery` rather than a manually-accumulated `useQuery`: each
  // mode/sort/search combination gets its own query key, so switching between
  // them starts a fresh page one automatically — no reset effect needed, and
  // React Query owns the accumulated pages instead of local state fighting an
  // effect over them.
  const feed = useInfiniteQuery<CursorPage<Post>>({
    queryKey: ["community", "feed", mode, gameId, sort, searchQuery],
    queryFn: ({ pageParam }) => {
      const cursor = (pageParam as string | null) ?? null
      if (mode === "search")
        return searchPosts(searchQuery, { cursor, limit: PAGE_SIZE })
      if (mode === "game")
        return getGameFeed(gameId ?? "", { sort, cursor, limit: PAGE_SIZE })
      return getExploreFeed({ sort, cursor, limit: PAGE_SIZE })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    staleTime: 30 * 1000,
    enabled: mode !== "game" || Boolean(gameId),
  })

  const posts = feed.data?.pages.flatMap((page) => page.items) ?? []
  const firstLoad = feed.isPending
  const loadingMore = feed.isFetchingNextPage

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {gameId && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2 gap-1.5"
            nativeButton={false}
            render={<Link href="/community" />}
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" />
            All communities
          </Button>
          <span className="text-sm text-muted-foreground">
            Viewing{" "}
            <span className="font-medium text-foreground">
              {game?.title ?? "this game"}
            </span>
            &apos;s community
          </span>
          <Button
            variant="link"
            size="sm"
            nativeButton={false}
            render={<Link href={`/games/${gameId}`} />}
          >
            Go to game page
          </Button>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold">
          {gameId ? "Game forum" : "Explore"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {gameId
            ? "Posts about this game, newest first."
            : "Every public post across every game — not personalised."}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search posts and tags"
            className="ps-8"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchInput("")}
              className="absolute inset-e-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Button
          size="sm"
          className="min-h-9 gap-1.5"
          onClick={() => setComposerOpen(true)}
        >
          <Plus className="size-3.5" />
          New post
        </Button>
      </div>

      {mode !== "search" && (
        <div
          role="radiogroup"
          aria-label="Sort posts"
          className="flex w-fit items-center rounded-lg border border-border p-0.5"
        >
          {SORTS.map(([option, label]) => {
            const isActive = sort === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setSort(option)}
                className={cn(
                  "min-h-8 rounded-md px-2.5 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {mode === "search" && (
        <p className="text-sm text-muted-foreground">
          Results for &#8220;{searchQuery}&#8221;
        </p>
      )}

      {firstLoad && (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!firstLoad && feed.isError && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          The feed did not load. Reload the page to try again.
        </p>
      )}

      {!firstLoad && !feed.isError && posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <MessagesSquare
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">
            {mode === "search"
              ? "No posts match that search"
              : "Nothing here yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "search"
              ? "Try a different word or tag."
              : "Be the first to post."}
          </p>
        </div>
      )}

      {posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {feed.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => feed.fetchNextPage()}
          >
            {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
            Load more
          </Button>
        </div>
      )}

      <PostComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        defaultGameId={gameId ?? undefined}
      />
    </div>
  )
}
