import type { Money } from "@/types/common.api.type"

/**
 * Formatting the platform's money shape.
 *
 * `amount_minor` arrives as a string holding an integer count of the currency's
 * minor unit — a string because a JavaScript client truncates integers above
 * 2^53, and IRR amounts reach that range.
 *
 * **Nothing here converts an amount to `number`.** The backend learned this the
 * expensive way: a notification that divided by 100 as a float rendered ...409.94
 * as ...409.93. Parsing is `BigInt`, splitting is `divmod`, and the grouping is
 * done by `Intl.NumberFormat`, which takes a BigInt and formats it losslessly.
 */

const MINOR_UNITS = 100n

const LOCALE = "en-US"
const GROUPED = new Intl.NumberFormat(LOCALE)
const PLAIN = new Intl.NumberFormat(LOCALE, { useGrouping: false })

/** Currency labels, keyed by ISO 4217. IRR is the platform's own. */
const CURRENCY_LABEL: Record<string, string> = {
  IRR: "IRR",
  USD: "$",
  EUR: "€",
}

function parseMinor(value: string): bigint {
  try {
    return BigInt(value)
  } catch {
    return 0n
  }
}

function split(minor: bigint): { sign: string; digits: string } {
  const negative = minor < 0n
  const absolute = negative ? -minor : minor
  const major = absolute / MINOR_UNITS
  const remainder = absolute % MINOR_UNITS

  // The minor part is dropped when it is zero, which for IRR is nearly always.
  // "10,000.00 IRR" on a store page is noise.
  const digits =
    remainder === 0n
      ? GROUPED.format(major)
      : `${GROUPED.format(major)}.${PLAIN.format(remainder).padStart(2, "0")}`

  return { sign: negative ? "−" : "", digits }
}

/** `{ amount_minor: "1000000", currency: "IRR" }` → `"10,000 IRR"`. */
export function formatMoney(money: Money | null | undefined): string {
  if (!money) return "—"
  const { sign, digits } = split(parseMinor(money.amount_minor))
  const label = CURRENCY_LABEL[money.currency] ?? money.currency
  // A symbol sits in front of the number, a code sits after it.
  return label.length === 1
    ? `${sign}${label}${digits}`
    : `${sign}${digits} ${label}`
}

/** Just the number, for places that label the currency separately. */
export function formatAmount(money: Money | null | undefined): string {
  if (!money) return "—"
  const { sign, digits } = split(parseMinor(money.amount_minor))
  return `${sign}${digits}`
}

/** Any integer. For counts, not for money. */
export function formatNumber(value: number | bigint): string {
  return GROUPED.format(value)
}

export function isZero(money: Money | null | undefined): boolean {
  return !money || parseMinor(money.amount_minor) === 0n
}

/** True when the game costs nothing — a 10000 bps promotion, or a free release. */
export function isFree(money: Money | null | undefined): boolean {
  return isZero(money)
}

export function currencyLabel(currency: string): string {
  return CURRENCY_LABEL[currency] ?? currency
}

/**
 * Basis points → a percentage. 2000 → "20".
 *
 * Not rounded to an integer: the catalog accepts any bps value, so 1250 is a real
 * possibility and showing it as "13" would misstate a price.
 */
export function percentOff(discountBps: number): string {
  const whole = discountBps / 100
  return Number.isInteger(whole)
    ? PLAIN.format(whole)
    : new Intl.NumberFormat(LOCALE, {
        useGrouping: false,
        maximumFractionDigits: 1,
      }).format(whole)
}

/** Sum of two amounts of the same currency, as a new `Money`. */
export function addMoney(a: Money, b: Money): Money {
  return {
    amount_minor: (
      parseMinor(a.amount_minor) + parseMinor(b.amount_minor)
    ).toString(),
    currency: a.currency,
  }
}

export function minorToMoney(minor: bigint | number, currency = "IRR"): Money {
  return { amount_minor: BigInt(minor).toString(), currency }
}

/** Integer division, for splitting a price into instalments the way the order
 *  service does — the caller is responsible for the remainder. */
export function divideMinor(money: Money, parts: number): Money {
  const minor = parseMinor(money.amount_minor)
  return {
    amount_minor: (minor / BigInt(parts)).toString(),
    currency: money.currency,
  }
}
