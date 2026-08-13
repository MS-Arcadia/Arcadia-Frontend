import type { Metadata } from "next"

import { FeaturedGames } from "@/components/marketing/featured-games"
import { LandingHero } from "@/components/marketing/landing-hero"
import { Reveal } from "@/components/marketing/reveal"
import { WorkflowDiagram } from "@/components/marketing/workflow-diagram"
import {
  ArrowRight,
  CalendarClock,
  Gift,
  Receipt,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  // `absolute` because the root layout's template appends "— Arcadia", and this
  // title already carries the name — the tab read "Arcadia — … — Arcadia".
  title: { absolute: "Arcadia — buy games four different ways" },
  description:
    "A game store with a wallet you can see the inside of. Pay once, split it over instalments, reserve before release, or send it to somebody else.",
}

interface Route {
  icon: LucideIcon
  title: string
  body: string
  detail: string
}

/**
 * The four ways to own a game.
 *
 * This is the section the whole page exists for, and every number in it is the real
 * rule from the service that enforces it — 2% on a gift message, twelve hours to
 * refund, a hold rather than a charge on a pre-order. A landing page quoting
 * different numbers from the checkout is worse than one quoting none.
 */
const ROUTES: Route[] = [
  {
    icon: Wallet,
    title: "Pay once",
    body: "The price leaves your wallet and the game is in your library.",
    detail: "Twelve hours to change your mind, then the sale is final.",
  },
  {
    icon: Receipt,
    title: "Pay in instalments",
    body: "Split the price across payments and play from the first one.",
    detail: "Stop paying past the grace period and the game is taken back.",
  },
  {
    icon: CalendarClock,
    title: "Reserve before release",
    body: "Your money is held, not spent, until the game ships.",
    detail: "Cancel any time before release and the hold is simply released.",
  },
  {
    icon: Gift,
    title: "Send it to somebody",
    body: "It lands in their library, with a note if you want one.",
    detail: "A message costs 2% of the price. Without one, it is free.",
  },
]

export default function LandingPage() {
  return (
    <>
      <LandingHero />

      {/* Real games, before the explanation of how to buy them. */}
      <FeaturedGames />

      {/* --- the four routes ------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Most stores have one button
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Arcadia has four, and they are not variations on each other. One
            spends, one schedules months of spending, one commits money without
            spending it, and one gives the game away. Each is a different
            promise, so each says what it costs you.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {ROUTES.map((route, index) => (
            <Reveal key={route.title} index={index}>
              <article className="h-full rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary"
                >
                  <route.icon className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-base font-semibold">{route.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {route.body}
                </p>
                <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground/70">
                  {route.detail}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- the wallet ------------------------------------------------- */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-28">
          <Reveal>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              A wallet you can see the inside of
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Every movement is a line you can read: what was taken, what it was
              for, and the balance afterwards. Nothing is edited after the fact
              — a refund is a new credit, not a reversal that makes the original
              disappear.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Which means the balance is never a number the platform asserts. It
              is the sum of the lines, and you have all of them.
            </p>
          </Reveal>

          <Reveal index={1}>
            {/* A real ledger shape rather than an illustration: three entries, each
                with its running balance, because that relationship is the point. */}
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {[
                {
                  label: "Opening balance",
                  amount: "+3,500,000",
                  after: "3,500,000",
                },
                {
                  label: "Purchase — Neon Drift",
                  amount: "−360,000",
                  after: "3,140,000",
                },
                {
                  label: "Refund — Neon Drift",
                  amount: "+360,000",
                  after: "3,500,000",
                },
              ].map((entry) => (
                <li key={entry.label} className="flex items-baseline gap-3 p-4">
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  <span className="text-sm tabular">{entry.amount}</span>
                  <span className="w-24 text-end text-xs text-muted-foreground tabular">
                    {entry.after}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* --- for developers -------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="max-w-2xl">
          <span className="text-xs font-medium tracking-wide text-primary uppercase">
            For developers
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            Nothing goes on sale by accident
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            A game reaches the store through a review, and the two decisions in
            it belong to different people. Support decides whether it can be
            sold. You decide what it costs.
          </p>
        </Reveal>

        <Reveal index={1} className="mt-12">
          <WorkflowDiagram />
        </Reveal>

        <Reveal index={2} className="mt-10">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A rejection has to say why, and you can answer it — an appeal puts
            the game back in the queue with your note attached. Support can
            suggest a price; it is advice, and it does not bind you. A festival
            discount needs your approval before it starts, because the reduced
            price is still shared 70/30 and therefore comes out of your revenue.
          </p>
        </Reveal>
      </section>

      {/* --- close ------------------------------------------------------ */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center lg:px-10 lg:py-28">
          <Reveal>
            <ShieldCheck
              className="mx-auto size-8 text-primary"
              strokeWidth={1.5}
              aria-hidden
            />
            <h2 className="mt-6 font-display text-3xl font-bold sm:text-4xl">
              New accounts are approved by a person
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
              Registering does not sign you in. An administrator approves the
              account first, and you are told when that happens — so the sign-in
              page never refuses you without explaining itself.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
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
                I already have one
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
