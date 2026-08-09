import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { CursorPage } from "@/types/common.api.type"
import type {
  Comment,
  FeedSort,
  Post,
  ReactionSummary,
  Report,
  ResolutionAction,
} from "@/types/community.api.type"

export const communityKeys = {
  all: ["community"] as const,
  gameFeed: (gameId: string, filters: FeedFilters) =>
    ["community", "game-feed", gameId, filters] as const,
  exploreFeed: (filters: FeedFilters) =>
    ["community", "explore", filters] as const,
  search: (query: string, filters: FeedFilters) =>
    ["community", "search", query, filters] as const,
  post: (id: string) => ["community", "posts", id] as const,
  comments: (postId: string, cursor: string | null) =>
    ["community", "posts", postId, "comments", cursor] as const,
  moderationQueue: (cursor: string | null) =>
    ["community", "moderation", cursor] as const,
}

export interface FeedFilters {
  sort?: FeedSort
  cursor?: string | null
  limit?: number
}

export async function getGameFeed(
  gameId: string,
  filters: FeedFilters
): Promise<CursorPage<Post>> {
  const { data } = await http.get<CursorPage<Post>>(
    API.community.gameFeed(gameId),
    { params: filters }
  )
  return data
}

export async function getExploreFeed(
  filters: FeedFilters
): Promise<CursorPage<Post>> {
  const { data } = await http.get<CursorPage<Post>>(API.community.exploreFeed, {
    params: filters,
  })
  return data
}

export async function searchPosts(
  q: string,
  filters: FeedFilters
): Promise<CursorPage<Post>> {
  const { data } = await http.get<CursorPage<Post>>(API.community.search, {
    params: { q, ...filters },
  })
  return data
}

export async function getPost(id: string): Promise<Post> {
  const { data } = await http.get<Post>(API.community.post(id))
  return data
}

/** Profile's top-5 shelf — community is the source of truth for the full post. */
export async function getTopPostsByAuthor(authorId: string): Promise<Post[]> {
  const { data } = await http.get<Post[]>(API.community.topPosts(authorId))
  return data
}

export interface CreatePostInput {
  game_id: string
  body?: string
  spoiler?: boolean
  tags?: string[]
  files?: File[]
}

/**
 * Always multipart, even with no files. The JSON `POST /posts` route has no
 * attachments field on its request schema at all — the only way a post can
 * carry a photo, video or file is this one, which community-service uploads
 * to media-service on the caller's behalf.
 */
export async function createPost(input: CreatePostInput): Promise<Post> {
  const form = new FormData()
  form.set("game_id", input.game_id)
  if (input.body) form.set("body", input.body)
  form.set("spoiler", String(input.spoiler ?? false))
  if (input.tags?.length) form.set("tags", JSON.stringify(input.tags))
  for (const file of input.files ?? []) form.append("files", file)

  const { data } = await http.post<Post>(
    API.community.createPostMultipart,
    form,
    // Letting the browser compute the multipart boundary is what makes this a
    // real multipart request rather than JSON with a misleading header — axios
    // removes a header set to `undefined` from what it sends.
    { headers: { "Content-Type": undefined } }
  )
  return data
}

export interface EditPostBody {
  body?: string | null
  spoiler?: boolean
  tags?: string[]
}

export async function editPost(id: string, body: EditPostBody): Promise<Post> {
  const { data } = await http.patch<Post>(API.community.editPost(id), body)
  return data
}

export async function deletePost(id: string): Promise<void> {
  await http.delete(API.community.deletePost(id))
}

export async function getComments(
  postId: string,
  cursor: string | null,
  limit = 20
): Promise<CursorPage<Comment>> {
  const { data } = await http.get<CursorPage<Comment>>(
    API.community.comments(postId),
    { params: { cursor: cursor ?? undefined, limit } }
  )
  return data
}

export async function addComment(
  postId: string,
  body: string
): Promise<Comment> {
  const { data } = await http.post<Comment>(API.community.comments(postId), {
    body,
  })
  return data
}

export async function editComment(id: string, body: string): Promise<Comment> {
  const { data } = await http.patch<Comment>(API.community.editComment(id), {
    body,
  })
  return data
}

export async function deleteComment(id: string): Promise<void> {
  await http.delete(API.community.deleteComment(id))
}

/** PUT is idempotent on purpose: sending the currently-held emoji again clears it. */
export async function setReaction(
  postId: string,
  emoji: string
): Promise<ReactionSummary> {
  const { data } = await http.put<ReactionSummary>(
    API.community.reaction(postId),
    { emoji }
  )
  return data
}

export async function clearReaction(postId: string): Promise<ReactionSummary> {
  const { data } = await http.delete<ReactionSummary>(
    API.community.reaction(postId)
  )
  return data
}

export async function reportPost(
  postId: string,
  reason: string
): Promise<Report> {
  const { data } = await http.post<Report>(API.community.reportPost(postId), {
    reason,
  })
  return data
}

export async function reportComment(
  commentId: string,
  reason: string
): Promise<Report> {
  const { data } = await http.post<Report>(
    API.community.reportComment(commentId),
    { reason }
  )
  return data
}

/** Support/Admin only. Only the open queue is exposed — there is no archive route. */
export async function getModerationQueue(
  cursor: string | null,
  limit = 20
): Promise<CursorPage<Report>> {
  const { data } = await http.get<CursorPage<Report>>(
    API.community.moderationQueue,
    { params: { status: "open", cursor: cursor ?? undefined, limit } }
  )
  return data
}

/** Support/Admin only. `note` is required for both outcomes. */
export async function resolveReport(
  reportId: string,
  action: ResolutionAction,
  note: string
): Promise<Report> {
  const { data } = await http.post<Report>(
    API.community.resolveReport(reportId),
    { action, note }
  )
  return data
}
