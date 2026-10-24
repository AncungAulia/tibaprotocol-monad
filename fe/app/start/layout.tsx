import type { ReactNode } from "react"
import { Logo } from "@/components/elements/Logo"

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-surface px-4 py-6 md:bg-canvas md:px-10 md:py-8">
      <Logo />
      <main
        id="main-content"
        className="mx-auto flex min-h-[calc(100dvh-112px)] max-w-[1440px] items-start justify-center py-8 md:items-center"
      >
        {children}
      </main>
    </div>
  )
}
