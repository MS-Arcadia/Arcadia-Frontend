import Link from "next/link"
import { WifiOff } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Offline" }

/**
 * What the service worker serves when a navigation cannot reach the network.
 *
 * Says what happened rather than pretending: the store, the wallet and the library
 * are all server state, and a cached copy of any of them would be a number that
 * used to be true. The only honest offline screen for this app is this one.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-10 w-36 opacity-60" />

      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <WifiOff className="size-5" strokeWidth={1.75} />
      </span>

      <h1 className="mt-5 text-lg font-semibold">No connection</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Arcadia needs the network for prices, balances and your library —
        showing you a saved copy would mean showing you numbers that may have
        changed.
      </p>

      <Button
        className="mt-6 min-h-11"
        nativeButton={false}
        render={<Link href="/store" />}
      >
        Try again
      </Button>
    </div>
  )
}
