"use client"

import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * The publishing pipeline, as the six steps it actually is.
 *
 * Numbered, and the numbers are load-bearing rather than decorative: this genuinely
 * is a sequence, each step is blocked until the one before it is done, and the
 * catalog refuses an attempt to skip one. That is the case where numbered markers
 * carry information instead of just structure.
 *
 * Colour says who acts. Support's two steps are the cool brand hue, the developer's
 * four are the primary, so the hand-offs are visible without reading the labels.
 */

interface Step {
  label: string
  actor: "developer" | "support"
}

const STEPS: Step[] = [
  { label: "Register the game", actor: "developer" },
  { label: "Upload a build", actor: "developer" },
  { label: "Submit for review", actor: "developer" },
  { label: "Review and decide", actor: "support" },
  { label: "Set the price", actor: "developer" },
  { label: "Publish", actor: "developer" },
]

export function WorkflowDiagram() {
  const reduced = useReducedMotion()

  return (
    <div className="space-y-4">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => {
          const support = step.actor === "support"
          return (
            <motion.li
              key={step.label}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.4, delay: index * 0.07 }
              }
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4",
                support
                  ? "border-brand-sky/25 bg-brand-sky/5"
                  : "border-border bg-card"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
                  support
                    ? "bg-brand-sky/15 text-brand-sky"
                    : "bg-primary/15 text-primary"
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.label}</p>
                <p
                  className={cn(
                    "text-xs",
                    support ? "text-brand-sky/80" : "text-muted-foreground"
                  )}
                >
                  {support ? "Support" : "Developer"}
                </p>
              </div>
            </motion.li>
          )
        })}
      </ol>

      <p className="text-xs text-muted-foreground/70">
        Six steps, in order. Submitting without a build is refused, and so is
        publishing without a price.
      </p>
    </div>
  )
}
