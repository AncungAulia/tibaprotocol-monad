import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { instrumentSans } from "@/lib/fonts"
import { AppProviders } from "@/providers/AppProviders"
import "@/styles/globals.css"

export const metadata: Metadata = {
  title: { default: "tiba", template: "%s · tiba" },
  description: "Goods arrive. Cash flows. Truck owners get paid the moment goods arrive.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }],
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#F2F2F2",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-5 focus:py-3"
        >
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
