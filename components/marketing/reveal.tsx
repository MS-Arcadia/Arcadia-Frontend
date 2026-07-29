"use client"

import { motion, useReducedMotion } from "motion/react"

interface Props {
  children: React.ReactNode
  /** Stagger position, for a group of siblings that should land in sequence. */
  index?: number
  className?: string
}

/**
 * A scroll-triggered rise, used for every section on the landing page.
 *
 * One component rather than motion props scattered through the page, so the timing
 * is consistent — a landing page where each section eases differently reads as
 * unfinished rather than as varied. `once: true` because a section that re-animates
 * every time it re-enters the viewport is the thing that makes people scroll past.
 *
 * Under `prefers-reduced-motion` this renders as a plain div: not a faster
 * animation, none at all.
 */
export function Reveal({ children, index = 0, className }: Props) {
  const reduced = useReducedMotion()

  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
