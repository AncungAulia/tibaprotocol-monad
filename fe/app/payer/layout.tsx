import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/AppShell"

export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell role="payer">{children}</AppShell>
}
