/** Every key this app writes to browser storage. Defined once so a rename is one
 *  edit and a collision is visible. */
export const STORAGE_KEYS = {
  accessToken: "arcadia.access-token",
  refreshToken: "arcadia.refresh-token",
  auth: "arcadia.auth",
  storeView: "arcadia.store-view",
  pwaPrompt: "arcadia.pwa-prompt",
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
