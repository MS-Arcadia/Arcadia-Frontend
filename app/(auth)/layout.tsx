import Link from "next/link"

import { Logo } from "@/components/brand/logo"

/**
 * The signed-out shell.
 *
 * Its own route group, so the sidebar and the wallet chip are not rendered around
 * a form that cannot use them. One column, centred, with the brand washes from
 * `body` doing the work — there is nothing to navigate to yet.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/sign-in" aria-label="Arcadia" className="mb-10 block">
        <Logo priority className="w-44" />
      </Link>

      <main className="w-full max-w-sm">{children}</main>

      <p className="mt-10 text-center text-xs text-muted-foreground/60">
        Arcadia — game distribution platform
      </p>
    </div>
  )
}
