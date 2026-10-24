import type { Metadata, Viewport } from "next"
import { Instrument_Sans, Instrument_Serif } from "next/font/google"
import { SmoothScroll } from "@/components/SmoothScroll"
import "lenis/dist/lenis.css"
import "./globals.css"

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
})

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
})

const title = "TIBA, invoice financing that pays on arrival"
const description =
  "TIBA pays truck companies the moment a warehouse confirms the delivery. The shipper pays later, on the date they agreed to. Live on Monad testnet."

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "TIBA",
  description,
  manifest: "/site.webmanifest",
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "TIBA",
    images: ["/clay/hero-scene.webp"],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/clay/hero-scene.webp"] },
}

export const viewport: Viewport = {
  themeColor: "#F2F2F2",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${instrumentSerif.variable} antialiased`}
    >
      <head>
        {/* Runs before the browser restores the old scroll position, so a reload opens on the hero. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'history.scrollRestoration="manual";addEventListener("pagehide",function(){scrollTo(0,0)});',
          }}
        />
      </head>
      <body className="min-h-dvh bg-canvas text-ink">
        <SmoothScroll />
        {children}
      </body>
    </html>
  )
}
