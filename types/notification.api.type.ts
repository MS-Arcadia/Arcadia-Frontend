/** Transcribed from notification-service/app/application/dto.py. */

/**
 * Named for the reader's experience rather than the publishing service's event —
 * `GIFT_RECEIVED`, not `GiftSent` — because the person being told is the one who
 * received it. A client groups, filters and picks an icon by this.
 */
export type NotificationKind =
  | "GAME_APPROVED"
  | "GAME_REJECTED"
  | "GIFT_RECEIVED"
  | "TRADE_MATCHED"
  | "FESTIVAL_STARTED"
  | "ACCOUNT_BANNED"
  | "ACCOUNT_UNBANNED"
  | "REGISTRATION_APPROVED"
  | "REGISTRATION_REJECTED"
  | "ROLE_GRANTED"
  | "PURCHASE_COMPLETED"
  | "PURCHASE_FAILED"
  | "ORDER_REFUNDED"
  | "PREORDER_RELEASED"
  | "INSTALMENT_PLAN_STARTED"
  | "INSTALMENT_PAID"
  | "INSTALMENT_PLAN_COMPLETED"
  | "INSTALMENT_PLAN_DEFAULTED"
  | "PROMOTION_PROPOSED"

/** What the notification is about, so a client can build its own link. A URL is
 *  deliberately not stored server-side: it would rot the first time the front
 *  end is reorganised. */
export type NotificationSubject =
  "GAME" | "ORDER" | "INSTALMENT_PLAN" | "ACCOUNT" | "TRADE" | "FESTIVAL"

export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  subject_type: NotificationSubject
  subject_id: string
  read: boolean
  created_at: string | null
  read_at: string | null
}

export interface UnreadCount {
  unread: number
}

export interface MarkedRead {
  marked: number
}
