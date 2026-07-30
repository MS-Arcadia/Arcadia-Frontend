"use client"

import { useQuery } from "@tanstack/react-query"

import { authKeys, getProfile } from "@/api/auth"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth.store"

interface Props {
  authorId: string
  className?: string
}

/**
 * `Post.author_id`/`Comment.author_id` are bare ids — community-service has
 * no denormalized profile on either, same precedent as auth-service having no
 * `/me`. auth-service *does* expose a by-id profile lookup, so this reuses it
 * for a real name; a failed or still-loading lookup falls back to a short id
 * chip, which is an honest result rather than a blank one.
 */
export function AuthorChip({ authorId, className }: Props) {
  const me = useAuthStore((state) => state.user)
  const isMe = Boolean(me && me.user_id === authorId)

  const { data } = useQuery({
    queryKey: authKeys.profile(authorId),
    queryFn: () => getProfile(authorId),
    enabled: !isMe && Boolean(authorId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const label = isMe
    ? (me?.display_name ?? "You")
    : (data?.display_name ?? `${authorId.slice(0, 10)}…`)

  return <span className={cn("truncate", className)}>{label}</span>
}
