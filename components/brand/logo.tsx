import Image from "next/image"

import { cn } from "@/lib/utils"

interface Props {
  className?: string
  priority?: boolean
}

/**
 * The wordmark, as the artwork rather than as type.
 *
 * The logo is a six-stop gradient across custom letterforms — no font
 * reproduces it, and approximating it with a display face plus a CSS gradient
 * would produce something close enough to look like a mistake. So the PNG is the
 * logo, and the type system stays out of its way.
 */
export function Logo({ className, priority = false }: Props) {
  return (
    <Image
      src="/logo.png"
      alt="Arcadia"
      width={1890}
      height={574}
      priority={priority}
      className={cn("h-auto w-full select-none", className)}
    />
  )
}

/**
 * The collapsed mark, for a narrow rail and the mobile bar.
 *
 * An "A" in the wordmark's own gradient rather than a cropped PNG: cropping the
 * artwork to a square gives a sliver of two letters, which reads as a broken
 * image rather than as a monogram.
 */
export function LogoMark({ className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "brand-gradient-text font-display text-2xl leading-none font-bold tracking-tighter select-none",
        className
      )}
    >
      A
    </span>
  )
}
