"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ls } from "@/lib/local-storage"
import { STORAGE_KEYS } from "@/lib/storage-keys"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** Two weeks. Long enough that a "not now" is respected, short enough that
 *  somebody who changes their mind is offered it again. */
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

/**
 * The install offer.
 *
 * Held back rather than shown on arrival, for two reasons. `beforeinstallprompt`
 * only fires when the browser considers the app installable at all, so there is
 * nothing to show until it does — and asking somebody to install a store before
 * they have seen a single game is asking the wrong question first.
 *
 * A dismissal is remembered. Re-asking on every page load is the behaviour that
 * teaches people to ignore the banner.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissedAt = ls.get<number>(STORAGE_KEYS.pwaPrompt, 0)
    if (Date.now() - dismissedAt < COOLDOWN_MS) return

    const onPrompt = (raw: Event) => {
      // Chrome shows its own mini-infobar unless this is prevented, and two
      // prompts for the same thing is one too many.
      raw.preventDefault()
      setEvent(raw as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])

  const dismiss = () => {
    ls.set(STORAGE_KEYS.pwaPrompt, Date.now())
    setVisible(false)
  }

  if (!visible || !event) return null

  return (
    <div
      role="dialog"
      aria-label="Install Arcadia"
      className="fixed start-4 bottom-20 z-50 max-w-xs rounded-xl border border-border bg-card p-4 shadow-lg lg:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          <Download className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install Arcadia</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Its own window, and your library stays reachable when the connection
            is not.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Not now"
          onClick={dismiss}
          className="-me-1 -mt-1"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <Button
        className="mt-3 min-h-11 w-full"
        onClick={async () => {
          await event.prompt()
          const { outcome } = await event.userChoice
          // Either way the prompt is spent — the event cannot be used twice.
          if (outcome === "dismissed")
            ls.set(STORAGE_KEYS.pwaPrompt, Date.now())
          setVisible(false)
          setEvent(null)
        }}
      >
        Install
      </Button>
    </div>
  )
}
