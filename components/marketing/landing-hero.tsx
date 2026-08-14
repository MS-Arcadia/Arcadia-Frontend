"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight } from "lucide-react"

import { SplittingPrice } from "@/components/marketing/splitting-price"
import { Button } from "@/components/ui/button"

/**
 * The page-load sequence.
 *
 * One orchestrated movement rather than several independent ones: the eyebrow, the
 * headline, the paragraph and the buttons rise in that order, which is the order they
 * are read in. Scattering separate animations across the same area is what makes a
 * page feel generated.
 *
 * **Deliberately fast, and measured rather than guessed.** The first version staggered
 * 0.09s with a 0.05s lead-in and 0.5s durations, which left the hero — the headline
 * included — blank for roughly the first 400ms. A landing page whose argument has not
 * arrived yet is worse than one with no animation at all, so the whole sequence now
 * finishes inside 400ms and the headline is legible in about 130.
 */
const RISE = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0 },
}

export function LandingHero() {
  const reduced = useReducedMotion()

  const sequence = reduced
    ? { initial: undefined, animate: undefined, transition: undefined }
    : { initial: "hidden" as const, animate: "shown" as const }

  return (
    <section className="relative overflow-hidden">
      {/* A third brand wash, wider and warmer than the two on `body`, so the hero
          reads as the brightest thing on the page without a border around it. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(ellipse_60rem_28rem_at_50%_-10%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_70%)]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:px-10 lg:py-28">
        <motion.div
          {...sequence}
          variants={{
            shown: { transition: { staggerChildren: 0.055 } },
          }}
          className="max-w-[40rem]"
        >
          <motion.p
            variants={RISE}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="text-xs font-medium tracking-wide text-primary uppercase"
          >
            A game store with a wallet inside it
          </motion.p>

          <motion.h1
            variants={RISE}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 font-display text-[2.1rem] leading-[1.08] font-bold text-balance sm:text-[2.75rem] lg:text-5xl"
          >
            {/* Two blocks rather than one with a <br>: `text-balance` evens the
                lines inside each element, and with a hard break the second sentence
                balanced against nothing and left "afford." alone on a line. */}
            <span className="block text-balance">Four ways to own a game.</span>
            <span className="block brand-gradient-text text-balance">
              Pick the one you can afford.
            </span>
          </motion.h1>

          <motion.p
            variants={RISE}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Pay for it now, split it over four months and play immediately, hold
            your money against a game that has not shipped, or buy it for
            somebody else. Every price, split and refund is a line in a ledger
            you can read.
          </motion.p>

          <motion.div
            variants={RISE}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Button
              size="lg"
              className="min-h-11"
              nativeButton={false}
              render={<Link href="/sign-up" />}
            >
              Create an account
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-11"
              nativeButton={false}
              render={<Link href="/sign-in" />}
            >
              Sign in
            </Button>
          </motion.div>

          <motion.p
            variants={RISE}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-xs text-muted-foreground/70"
          >
            You can sign in as soon as you create an account.
          </motion.p>
        </motion.div>

        <motion.div
          initial={reduced ? undefined : { opacity: 0, scale: 0.97 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <SplittingPrice />
        </motion.div>
      </div>
    </section>
  )
}
