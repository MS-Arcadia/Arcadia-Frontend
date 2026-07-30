/** Transcribed from community-service/docs/contracts/rest/community-openapi.json. */

export type FeedSort = "newest" | "most_viewed" | "most_reacted"

export type AttachmentKind = "IMAGE" | "VIDEO" | "FILE"
export type AttachmentStatus = "PENDING" | "READY" | "FAILED"

export interface Attachment {
  id: string
  kind: AttachmentKind
  /** A bare ref/id — resolve the actual URL through media-service separately. */
  media_ref: string
  status: AttachmentStatus
}

export type PostStatus = "ACTIVE" | "REMOVED_BY_MODERATION" | "DELETED"

export interface Post {
  id: string
  game_id: string
  author_id: string
  body: string
  spoiler: boolean
  tags: string[]
  attachments: Attachment[]
  /** Per-emoji breakdown, e.g. `{ "👍": 3, "🔥": 1 }` — not just a total. */
  reactions: Record<string, number>
  comment_count: number
  view_count: number
  feedback_score: number
  status: PostStatus
  created_at: string
  edited_at: string | null
}

export type CommentStatus = "ACTIVE" | "REMOVED_BY_MODERATION" | "DELETED"

export interface Comment {
  id: string
  post_id: string
  author_id: string
  body: string
  status: CommentStatus
  created_at: string
  edited_at: string | null
}

export interface ReactionSummary {
  post_id: string
  reactions: Record<string, number>
  total: number
  /** The caller's own current emoji, for picker state. Null if they have not reacted. */
  my_reaction: string | null
}

/** The closed emoji catalog — anything else is refused with 422. */
export const REACTION_EMOJI = [
  "👍",
  "👎",
  "❤️",
  "🔥",
  "😂",
  "😮",
  "😢",
  "😡",
  "🎉",
  "🤔",
  "💯",
  "🎮",
] as const

export type ReportTargetType = "POST" | "COMMENT"
export type ReportStatus = "OPEN" | "RESOLVED_REMOVED" | "RESOLVED_DISMISSED"
export type ResolutionAction = "REMOVE" | "DISMISS"

export interface Report {
  id: string
  target_type: ReportTargetType
  target_id: string
  reporter_id: string
  reason: string
  status: ReportStatus
  resolved_by: string | null
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
}
