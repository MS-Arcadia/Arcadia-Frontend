"use client"

import { create } from "zustand"

/**
 * "My reaction" per post, for this browser tab only.
 *
 * `Post` (the feed/get-post shape) carries only the aggregate `reactions`
 * count map — the caller's own emoji comes back solely on the response of the
 * set/clear-reaction endpoints (`ReactionSummary.my_reaction`). Rather than
 * pretend the feed knows something it does not, this store remembers what the
 * picker was just told, session-only and not persisted: a post you reacted to
 * a moment ago shows your emoji highlighted, a post loaded fresh from a feed
 * does not claim to know one way or the other.
 */
interface CommunityReactionsStore {
  myReactions: Record<string, string>
  setReaction: (postId: string, emoji: string | null) => void
}

export const useCommunityReactionsStore = create<CommunityReactionsStore>()(
  (set) => ({
    myReactions: {},
    setReaction: (postId, emoji) =>
      set((state) => {
        const next = { ...state.myReactions }
        if (emoji) next[postId] = emoji
        else delete next[postId]
        return { myReactions: next }
      }),
  })
)
