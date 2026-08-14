/**
 * Catalog's PromotionState. Support proposes a discount as PENDING; only
 * ACTIVE (and inside the window) changes a price.
 *
 * The frontend used to look for "PROPOSED", a name the catalog has never
 * emitted, so the developer's approve/decline panel was always empty and
 * festival discounts never went live.
 */
export function isAwaitingDeveloper(state: string): boolean {
  return state === "PENDING"
}
