import type { MetadataRoute } from "next"

/**
 * The install manifest.
 *
 * `display: "standalone"` with a desktop-first product is not a contradiction:
 * installed desktop web apps get their own window and taskbar entry, which is the
 * main reason to ship a manifest here at all. The phone case is the same file.
 *
 * Written as a route rather than a static JSON file so the name and colours come
 * from one place and cannot drift from the metadata in `layout.tsx`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arcadia",
    short_name: "Arcadia",
    description:
      "Buy, gift, pre-order or pay in instalments, from a wallet that lives on the platform.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Library", url: "/library" },
      { name: "Wallet", url: "/wallet" },
    ],
  }
}
