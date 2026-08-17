import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { GameState } from "@/types/catalog.api.type"

/**
 * Where a game is in requirement 1.3's workflow, in the words the person looking
 * at it would use.
 *
 * Nine states, kept as nine. A developer whose game is SUBMITTED and one whose game
 * is IN_REVIEW are waiting on different things — the first on somebody picking it
 * up, the second on a decision — and collapsing both into "pending" would answer
 * the wrong question.
 */
const STATE: Record<GameState, { label: string; tone: keyof typeof TONE }> = {
  DRAFT: { label: "Draft", tone: "quiet" },
  SUBMITTED: { label: "Waiting for review", tone: "warn" },
  IN_REVIEW: { label: "In review", tone: "warn" },
  APPROVED: { label: "Approved", tone: "good" },
  REJECTED: { label: "Rejected", tone: "bad" },
  APPEALED: { label: "Appealed", tone: "warn" },
  PRICED: { label: "Waiting to publish", tone: "warn" },
  PREORDER: { label: "Pre-order", tone: "info" },
  PUBLISHED: { label: "On sale", tone: "good" },
}

const TONE = {
  quiet: "bg-muted text-muted-foreground border-border",
  info: "bg-brand-sky/15 text-brand-sky border-brand-sky/25",
  good: "bg-primary/15 text-primary border-primary/25",
  warn: "bg-warning/15 text-warning border-warning/25",
  bad: "bg-destructive/15 text-destructive border-destructive/25",
} as const

interface Props {
  state: GameState
  withdrawn?: boolean
  className?: string
}

export function GameStateBadge({ state, withdrawn = false, className }: Props) {
  // Withdrawn wins over the state: a PUBLISHED game that has been pulled is not
  // on sale, and showing "On sale" would be wrong rather than merely incomplete.
  if (withdrawn) {
    return <Badge className={cn(TONE.bad, className)}>Withdrawn</Badge>
  }
  const { label, tone } = STATE[state]
  return <Badge className={cn(TONE[tone], className)}>{label}</Badge>
}

export function stateLabel(state: GameState): string {
  return STATE[state].label
}
