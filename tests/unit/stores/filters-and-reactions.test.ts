import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useCommunityReactionsStore } from "@/stores/community-reactions.store"
import { useStoreFilters } from "@/stores/store-filters.store"

beforeEach(() => {
  useCommunityReactionsStore.setState(
    useCommunityReactionsStore.getInitialState()
  )
  useStoreFilters.setState(useStoreFilters.getInitialState())
})

describe("useStoreFilters", () => {
  it("starts at newest, unfiltered", () => {
    const { result } = renderHook(() => useStoreFilters())
    expect(result.current).toMatchObject({
      search: "",
      genre: null,
      sort: "newest",
      onlyDiscounted: false,
    })
  })

  it("each setter replaces its own field", () => {
    const { result } = renderHook(() => useStoreFilters())

    act(() => result.current.setSearch("neon"))
    act(() => result.current.setGenre("Racing"))
    act(() => result.current.setSort("price-asc"))

    expect(result.current.search).toBe("neon")
    expect(result.current.genre).toBe("Racing")
    expect(result.current.sort).toBe("price-asc")
  })

  it("toggleDiscounted flips only its own flag, and reset returns to the start", () => {
    const { result } = renderHook(() => useStoreFilters())

    act(() => result.current.toggleDiscounted())
    expect(result.current.onlyDiscounted).toBe(true)
    expect(result.current.search).toBe("")

    act(() => result.current.toggleDiscounted())
    expect(result.current.onlyDiscounted).toBe(false)

    act(() => {
      result.current.setSearch("x")
      result.current.setSort("newest")
      result.current.reset()
    })
    expect(result.current.search).toBe("")
    expect(result.current.sort).toBe("newest")
  })
})

describe("useCommunityReactionsStore", () => {
  it("a reaction is remembered per post, session-only", () => {
    const { result } = renderHook(() => useCommunityReactionsStore())

    act(() => result.current.setReaction("post-1", "🔥"))
    act(() => result.current.setReaction("post-2", "🎉"))

    expect(result.current.myReactions).toEqual({
      "post-1": "🔥",
      "post-2": "🎉",
    })
  })

  it("clearing removes the entry rather than storing a null", () => {
    const { result } = renderHook(() => useCommunityReactionsStore())

    act(() => result.current.setReaction("post-1", "🔥"))
    act(() => result.current.setReaction("post-1", null))

    expect(result.current.myReactions).toEqual({})
    expect("post-1" in result.current.myReactions).toBe(false)
  })

  it("re-reacting to one post leaves the others alone", () => {
    const { result } = renderHook(() => useCommunityReactionsStore())

    act(() => result.current.setReaction("post-1", "🔥"))
    act(() => result.current.setReaction("post-2", "🎉"))
    act(() => result.current.setReaction("post-1", "👀"))

    expect(result.current.myReactions).toEqual({
      "post-1": "👀",
      "post-2": "🎉",
    })
  })
})
