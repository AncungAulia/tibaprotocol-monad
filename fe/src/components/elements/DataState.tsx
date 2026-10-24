"use client"

import Link from "next/link"
import { PackageOpen, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "./Button"
import { useAuth } from "@/providers/AuthProvider"
import { errorMessage } from "@/lib/validation"
import { cn } from "@/lib/utils"

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("@container min-w-0 rounded-[28px] bg-surface p-6 md:p-8", className)}>
      {children}
    </section>
  )
}
export function EmptyState({
  title = "No shipments yet",
  description = "Your shipments will appear here once a company approves a trip.",
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="grid justify-items-center gap-3 py-12 text-center">
      <PackageOpen size={32} className="text-muted-ink" aria-hidden />
      <h2 className="text-heading font-medium">{title}</h2>
      <p className="max-w-sm text-muted-ink">{description}</p>
      {action}
    </div>
  )
}
export function QueryState({
  loading,
  error,
  retry,
  children,
}: {
  loading?: boolean
  error?: unknown
  retry?: () => void
  children: ReactNode
}) {
  const auth = useAuth()
  if (!auth.ready || loading)
    return (
      <div role="status" aria-label="Loading" className="space-y-4 py-6">
        <div className="h-28 rounded-[28px] bg-subtle" />
        <div className="h-48 rounded-[28px] bg-subtle" />
        <span className="sr-only">Loading your information</span>
      </div>
    )
  if (!auth.authenticated)
    return (
      <Card>
        <EmptyState
          title="Sign in to continue"
          description="Sign in with your wallet or your email to see your account."
          action={<Button onClick={auth.login}>Sign in</Button>}
        />
      </Card>
    )
  if (error)
    return (
      <Card>
        <div role="alert" className="space-y-4">
          <h2 className="text-heading">We could not load this information</h2>
          <p className="text-danger">{errorMessage(error)}</p>
          {retry && (
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          )}
        </div>
      </Card>
    )
  return <>{children}</>
}
/** Brand text link: stamp-deep, no arrow. Underline appears on hover and focus for a11y. */
export function TextLink({
  href,
  children,
  icon: Icon,
  className,
}: {
  href: string
  children: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-1.5 text-label font-medium text-stamp-deep underline-offset-4 hover:underline focus-visible:underline",
        className,
      )}
    >
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
    </Link>
  )
}
