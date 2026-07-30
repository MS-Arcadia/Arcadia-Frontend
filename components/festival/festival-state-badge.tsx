import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FestivalState } from "@/types/festival.api.type"

/**
 * Mirrors `GameStateBadge`'s pattern: one color per state, in the words a
 * shopper or an admin would use. ACTIVE gets the same "highlighted" primary
 * tone `PUBLISHED` gets on a game — it is the state the storefront actually
 * cares about.
 */
const STATE: Record<FestivalState, { label: string; tone: keyof typeof TONE }> =
  {
    DRAFT: { label: "Draft", tone: "quiet" },
    ACTIVE: { label: "Live now", tone: "good" },
    ENDED: { label: "Ended", tone: "muted" },
    CANCELLED: { label: "Cancelled", tone: "bad" },
  }

const TONE = {
  quiet: "bg-muted text-muted-foreground border-border",
  muted: "bg-muted/60 text-muted-foreground border-border",
  good: "bg-primary/15 text-primary border-primary/25",
  bad: "bg-destructive/15 text-destructive border-destructive/25",
} as const

interface Props {
  state: FestivalState
  className?: string
}

export function FestivalStateBadge({ state, className }: Props) {
  const { label, tone } = STATE[state]
  return <Badge className={cn(TONE[tone], className)}>{label}</Badge>
}
