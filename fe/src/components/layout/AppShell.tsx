"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Fragment, useEffect, type ReactNode } from "react"
import { Logo } from "@/components/elements/Logo"
import { WalletButton } from "@/modules/wallet/components/WalletButton"
import { WarehouseHubPill } from "@/modules/warehouse/components/WarehouseHubPill"
import { cn } from "@/lib/utils"
import type { Role } from "@/types/role"
import { roleHome } from "@/types/role"
import { useProfile } from "@/lib/queries"
import { useAuth } from "@/providers/AuthProvider"
import { QueryState } from "@/components/elements/DataState"
import { PendingPayment } from "@/components/elements/PendingPayment"
import { usePayerSetupStatus } from "@/modules/onboarding/hooks/usePayerSetupStatus"
import { activeNavHref, navItems } from "./nav-items"

/** Desktop/tablet: floating pill navbar. Mobile: header + floating bottom nav. */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const auth = useAuth()
  const profile = useProfile()
  const payer = usePayerSetupStatus(role === "payer" && profile.data?.role === "payer")
  useEffect(() => {
    if (profile.isSuccess && profile.data === null) router.replace("/start")
    else if (profile.data && profile.data.role !== role) router.replace(roleHome[profile.data.role])
    else if (payer.status === "setup") router.replace("/onboarding/payer")
  }, [profile.isSuccess, profile.data, role, router, payer.status])
  const opening =
    auth.authenticated &&
    (!profile.data ||
      profile.data.role !== role ||
      payer.status === "loading" ||
      payer.status === "setup")
  const items = navItems[role]
  const active = activeNavHref(pathname, items)

  return (
    <div className="min-h-dvh pb-28 md:pb-12">
      <header className="sticky top-0 z-20 bg-canvas/95 px-4 pt-4 md:bg-transparent md:px-6 lg:px-10">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-3 md:h-[72px] md:rounded-full md:bg-surface/90 md:px-6 md:backdrop-blur">
          <div className="flex min-w-0 items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 rounded-full bg-canvas p-1 md:flex">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-label font-medium transition-colors",
                    item.href === active
                      ? "bg-surface text-ink"
                      : "text-muted-ink hover:text-ink",
                  )}
                  aria-current={item.href === active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role === "warehouse" && <WarehouseHubPill />}
            <WalletButton role={role} />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-6 lg:px-10"
      >
        <PendingPayment />
        <QueryState
          loading={profile.isLoading}
          error={profile.error ?? (payer.status === "error" ? payer.company.error : null)}
          retry={() => void (profile.error ? profile.refetch() : payer.company.refetch())}
        >
          {opening ? (
            <p role="status">Opening your account...</p>
          ) : (
            <Fragment key={auth.address}>{children}</Fragment>
          )}
        </QueryState>
      </main>

      <nav className="fixed inset-x-4 bottom-4 z-20 flex justify-between rounded-full bg-ink p-2 shadow-float md:hidden">
        {items.map((item) => {
          const current = item.href === active
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-label font-medium",
                current ? "bg-stamp text-ink" : "text-white/80",
              )}
              aria-current={current ? "page" : undefined}
            >
              <item.icon className="size-5" aria-hidden />
              {current ? item.label : <span className="sr-only">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
