import type { Metadata, Viewport } from "next"
import { Chakra_Petch, Geist_Mono, Manrope } from "next/font/google"
import NextTopLoader from "nextjs-toploader"

import { AppProviders } from "@/providers/app-providers"
import { cn } from "@/lib/utils"

import "./globals.css"

/**
 * Manrope for everything that is read.
 *
 * A geometric humanist with slightly narrow proportions — it sits comfortably
 * under a wide techno display face without competing with it, and it is not
 * Inter, which is what every other dark dashboard reaches for by default.
 */
const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

/**
 * Chakra Petch for headings.
 *
 * Chosen against the logo rather than against the genre: the wordmark is a wide
 * geometric face with flat apexes and straight-legged letterforms, and this is
 * the closest widely available companion. Orbitron is the reflex pick for
 * anything gaming-shaped and reads as a costume; this is quieter and still
 * unmistakably not a neutral UI face.
 *
 * Headings only. It is too wide to carry a paragraph, and asking it to would
 * waste the one thing it is good at.
 */
const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
})

/** For ids, order numbers and download keys — the things people copy. */
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Arcadia",
    template: "%s — Arcadia",
  },
  description:
    "Buy, gift, pre-order or pay in instalments, from a wallet that lives on the platform.",
  applicationName: "Arcadia",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Arcadia",
    statusBarStyle: "black-translucent",
  },
}

export const viewport: Viewport = {
  // Dark-only by decision, declared so the browser chrome matches instead of
  // framing the app in white.
  colorScheme: "dark",
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  // Zoom stays enabled. Locking it is a common habit in installed web apps and
  // it trades away accessibility for nothing.
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      // `dark` sits on the element rather than being driven by next-themes: the
      // product has one theme, and letting the OS switch it would produce a light
      // render nobody designed.
      className={cn(
        "dark antialiased",
        sans.variable,
        display.variable,
        mono.variable
      )}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans">
        <NextTopLoader
          color="var(--primary)"
          height={2}
          showSpinner={false}
          shadow={false}
          crawl
          zIndex={9999}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
