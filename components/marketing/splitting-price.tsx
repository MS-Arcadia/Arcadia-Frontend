"use client"

import { motion, useReducedMotion } from "motion/react"

import { formatMoney, minorToMoney } from "@/lib/money"

/**
 * The signature moment: one price becoming four payments.
 *
 * This is the hero's whole argument, and it animates because the argument *is* a
 * transformation — a storefront where a price can be split is unusual, and showing
 * the split happen says that faster than a paragraph about requirement 3.3 does.
 *
 * The arithmetic is real, not decorative: integer division on minor units, with the
 * remainder on the last payment, exactly as the order service builds a schedule. A
 * marketing page that rounded differently from the checkout would be a lie told in
 * the most visible place on the site.
 */

const PRICE_MAJOR = 480_000n
const PARTS = 4

export function SplittingPrice() {
  const reduced = useReducedMotion()

  const total = PRICE_MAJOR * 100n
  const per = total / BigInt(PARTS)
  const last = total - per * BigInt(PARTS - 1)
  const parts = Array.from({ length: PARTS }, (_, index) =>
    index === PARTS - 1 ? last : per
  )

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm sm:p-8">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_65%)]"
      />

      <div className="relative space-y-6">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">One game</p>
          <p className="font-display text-3xl font-bold tabular sm:text-4xl">
            {formatMoney(minorToMoney(total))}
          </p>
        </div>

        {/* The split. Each part rises into place in turn, so the eye follows the
            division rather than being handed the result. */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">or four payments</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {parts.map((amount, index) => (
              <motion.div
                key={index}
                initial={
                  reduced ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.96 }
                }
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        // A spring rather than an ease: the parts should feel like
                        // they settle into place, and four of them landing in
                        // sequence reads as one movement instead of four.
                        type: "spring",
                        stiffness: 260,
                        damping: 24,
                        delay: 0.3 + index * 0.08,
                      }
                }
                className="rounded-xl border border-primary/25 bg-primary/10 px-2.5 py-3"
              >
                <p className="text-[0.7rem] text-primary/70">
                  {index + 1} of {PARTS}
                </p>
                <p className="mt-0.5 text-[0.8rem] font-semibold whitespace-nowrap text-primary tabular">
                  {formatMoney(minorToMoney(amount))}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.p
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: reduced ? 0 : 0.68, duration: 0.35 }}
          className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground"
        >
          The game is yours from the first payment. Stop paying for longer than
          the grace period and it is taken back — what you have already paid is
          not returned.
        </motion.p>
      </div>
    </div>
  )
}
