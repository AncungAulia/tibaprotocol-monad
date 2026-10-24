"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import {
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  Fuel,
  LogOut,
  Plus,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react"
import * as Popover from "@radix-ui/react-popover"
import { useBalance, useChainId, useReadContract, useSwitchChain } from "wagmi"
import { formatEther } from "viem"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PersonaAvatar } from "@/components/elements/PersonaAvatar"
import { Modal } from "@/components/elements/Modal"
import { Button } from "@/components/elements/Button"
import { TransactionStatus } from "@/components/elements/TransactionStatus"
import { useAuth } from "@/providers/AuthProvider"
import { useProfile } from "@/lib/queries"
import { contracts } from "@/lib/contracts"
import { monadTestnet } from "@/lib/chain"
import { env } from "@/lib/env"
import { formatUsdc, shortAddress } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useTransaction } from "@/lib/ledger"
import type { Role } from "@/types/role"

function subscribeMobile(callback: () => void) {
  const query = window.matchMedia("(max-width: 767px)")
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}
function useMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  )
}

/** A row in the wallet menu (Pencil G1): icon circle, title, one-line note. */
function MenuItem({
  icon: Icon,
  title,
  note,
  danger = false,
}: {
  icon: LucideIcon
  title: string
  note?: string
  danger?: boolean
}) {
  return (
    <>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          danger ? "bg-danger/10 text-danger" : "bg-canvas text-ink",
        )}
      >
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14.5px] leading-5 font-medium", danger && "text-danger")}>
          {title}
        </span>
        {note && <span className="block text-caption text-muted-ink">{note}</span>}
      </span>
    </>
  )
}

const menuItemClass =
  "flex min-h-11 w-full items-center gap-3 rounded-[14px] p-3 text-left transition-colors duration-150 hover:bg-canvas"

export function FaucetButton({
  className = "",
  variant = "link",
  mon,
}: {
  className?: string
  /** "menu" renders the wallet menu row (Pencil G1) instead of the inline text link. */
  variant?: "link" | "menu"
  /** MON balance already loaded by the caller, shown in the fee note. */
  mon?: string
}) {
  const [open, setOpen] = useState(false)
  const auth = useAuth()
  const tx = useTransaction()
  const nextClaim = useReadContract({
    ...contracts.usdc,
    functionName: "nextClaimAt",
    args: auth.address ? [auth.address] : undefined,
    query: {
      enabled: !!auth.address && !!contracts.usdc.address,
      refetchInterval: open ? 15000 : false,
    },
  })
  const cooldown = nextClaim.data
    ? Math.max(0, Math.ceil(Number(nextClaim.data) - Date.now() / 1000))
    : 0
  // Re-render while locked so the minutes count down and the button unlocks on time.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!open || cooldown <= 0) return
    const timer = setTimeout(() => setTick((value) => value + 1), Math.min(30000, cooldown * 1000))
    return () => clearTimeout(timer)
  }, [open, cooldown, tick])
  const minutes = Math.ceil(cooldown / 60)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          tx.reset()
          setOpen(true)
        }}
        className={
          variant === "menu"
            ? cn(menuItemClass, className)
            : `min-h-11 text-left font-medium underline underline-offset-4 ${className}`
        }
      >
        {variant === "menu" ? (
          <MenuItem icon={Plus} title="Get test USDC" note="Free test money for the demo" />
        ) : (
          "Get test USDC"
        )}
      </button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!tx.pending) setOpen(value)
        }}
        title={tx.hash ? "1,000.00 test USDC added" : "Get test USDC"}
        description={
          tx.hash
            ? "It's test money and has no real value."
            : "Test money for trying tiba on the test network. It has no real value."
        }
      >
        {tx.hash ? (
          <span className="grid size-20 place-items-center rounded-full bg-stamp">
            <BadgeCheck size={34} strokeWidth={1.75} aria-hidden />
          </span>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-canvas px-5 py-4">
              <span className="text-muted-ink">You will get</span>
              <span className="text-[17px] leading-6 font-medium tabular-nums">1,000.00 USDC</span>
            </div>
            {cooldown > 0 ? (
              <div className="flex gap-2.5 rounded-md bg-stamp-soft px-4 py-3.5">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-stamp-deep" aria-hidden />
                <p className="text-[13.5px] leading-5">
                  You got test USDC recently. You can get more in {minutes}{" "}
                  {minutes === 1 ? "minute" : "minutes"}.
                </p>
              </div>
            ) : (
              <div className="flex gap-2.5 rounded-md border border-line px-3.5 py-3">
                <Fuel size={16} className="mt-0.5 shrink-0" aria-hidden />
                <p className="text-label">
                  You also need a little MON for network fees.
                  {mon ? ` You have ${mon} MON.` : ""}{" "}
                  <a
                    href={env.monFaucetUrl}
                    rel="noreferrer"
                    target="_blank"
                    className="inline-flex items-center gap-1 font-medium text-stamp-deep underline-offset-4 hover:underline"
                  >
                    Get MON for fees <ExternalLink size={12} aria-hidden />
                  </a>
                </p>
              </div>
            )}
          </>
        )}
        {nextClaim.isError && (
          <p role="alert" className="text-danger">
            We could not check when you can claim. Please try again.
          </p>
        )}
        <TransactionStatus {...tx} pending={false} />
        {tx.hash ? (
          <Button className="w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        ) : (
          <div className="space-y-3">
            <Button
              className="w-full"
              icon={Plus}
              loading={tx.pending}
              disabled={
                !auth.authenticated ||
                !contracts.usdc.address ||
                nextClaim.isPending ||
                nextClaim.isError ||
                cooldown > 0
              }
              onClick={() => {
                void tx.run("faucet").catch(() => {})
              }}
            >
              {tx.pending ? "Waiting for wallet" : "Get 1,000 test USDC"}
            </Button>
            {tx.pending && (
              <p role="status" className="text-caption text-muted-ink">
                Approve it in your wallet. No cost besides a tiny fee.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

export function WalletButton({ role, name }: { role: Role; name?: string }) {
  const [open, setOpen] = useState(false)
  const auth = useAuth()
  const profile = useProfile()
  const mobile = useMobile()
  const router = useRouter()
  const queries = useQueryClient()
  const chainId = useChainId()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const balance = useBalance({
    address: auth.address,
    query: { enabled: !!auth.address, refetchInterval: 30000 },
  })
  const usdc = useReadContract({
    ...contracts.usdc,
    functionName: "balanceOf",
    args: auth.address ? [auth.address] : undefined,
    query: { enabled: !!auth.address && !!contracts.usdc.address, refetchInterval: 30000 },
  })
  const displayName = profile.data?.name || name || "Your account"
  if (!auth.authenticated)
    return (
      <Button disabled={!auth.ready} onClick={auth.login}>
        Sign in
      </Button>
    )
  const wrongNetwork = chainId !== monadTestnet.id
  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={wrongNetwork ? "Open wallet menu, wrong network" : "Open wallet menu"}
      aria-expanded={open}
      // Phones show just the avatar, as in the mobile header design; the name pill returns from `sm`.
      className="relative flex min-h-11 items-center gap-2.5 rounded-full sm:border sm:border-line sm:py-1.5 sm:pr-3.5 sm:pl-1.5 md:gap-3"
    >
      <PersonaAvatar role={role} size={40} className="size-11 sm:size-8" />
      {wrongNetwork && (
        <span className="absolute top-0 right-0 size-3 rounded-full bg-warning ring-2 ring-canvas sm:hidden" />
      )}
      <span className="hidden text-left leading-tight sm:block">
        <span className="block text-label font-semibold">
          {wrongNetwork ? "Wrong network" : displayName}
        </span>
        <span className="block text-caption text-muted-ink capitalize">{role}</span>
      </span>
      <ChevronDown className="hidden size-4 text-muted-ink sm:block" aria-hidden />
    </button>
  )
  const monLabel = balance.data
    ? Number(formatEther(balance.data.value)).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    : undefined
  const content = (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-1">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayName}</p>
          <p className="truncate text-caption text-muted-ink">
            <span className="capitalize">{role}</span>
            {" · "}
            {auth.address ? shortAddress(auth.address) : "Preparing your wallet"}
          </p>
        </div>
        {auth.address && (
          <button
            type="button"
            aria-label="Copy wallet address"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-ink hover:bg-canvas hover:text-ink"
            onClick={() => {
              if (auth.address)
                void navigator.clipboard
                  .writeText(auth.address)
                  .then(() => toast.success("Wallet address copied"))
                  .catch(() => toast.error("Could not copy. Please try again."))
            }}
          >
            <Copy size={16} aria-hidden />
          </button>
        )}
        <PersonaAvatar role={role} size={40} />
      </div>
      <dl className="grid grid-cols-2 gap-2.5">
        <div className="min-w-0 rounded-md bg-canvas px-4 py-3.5">
          <dt className="text-caption text-muted-ink">USDC</dt>
          <dd className="mt-1 truncate text-[22px] leading-7 font-medium tabular-nums">
            {usdc.data !== undefined
              ? formatUsdc(usdc.data)
              : usdc.isError
                ? "Unavailable"
                : !contracts.usdc.address
                  ? "Not configured"
                  : "Loading..."}
          </dd>
          <dd className="mt-1 text-[11.5px] leading-4 text-muted-ink">For bills and deposits</dd>
        </div>
        <div className="min-w-0 rounded-md bg-canvas px-4 py-3.5">
          <dt className="text-caption text-muted-ink">MON</dt>
          <dd className="mt-1 truncate text-[22px] leading-7 font-medium tabular-nums">
            {monLabel ?? (balance.isError ? "Unavailable" : "Loading...")}
          </dd>
          <dd className="mt-1 text-[11.5px] leading-4 text-muted-ink">For network fees</dd>
        </div>
      </dl>
      {wrongNetwork && (
        <Button
          className="w-full"
          disabled={switching}
          onClick={() => {
            void switchChainAsync({ chainId: monadTestnet.id }).catch(() =>
              toast.error("Network change was cancelled. Please try again."),
            )
          }}
        >
          Switch network
        </Button>
      )}
      <div className="h-px bg-line" />
      <div className="grid">
        <FaucetButton variant="menu" mon={monLabel} />
        <a href={env.monFaucetUrl} target="_blank" rel="noreferrer" className={menuItemClass}>
          <MenuItem icon={Fuel} title="Get MON for fees" note="Opens the Monad faucet" />
        </a>
        <button
          type="button"
          className={menuItemClass}
          onClick={() => {
            void auth
              .logout()
              .then(() => {
                queries.clear()
                setOpen(false)
                router.replace("/start")
              })
              .catch(() => toast.error("Could not disconnect. Please try again."))
          }}
        >
          <MenuItem icon={LogOut} title="Disconnect" danger />
        </button>
      </div>
    </div>
  )
  return mobile ? (
    <>
      {trigger}
      <Modal open={open} onOpenChange={setOpen} title="Your wallet">
        {content}
      </Modal>
    </>
  ) : (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Your wallet"
          align="end"
          sideOffset={12}
          className="tiba-popover z-30 w-[380px] max-w-[calc(100vw-32px)] rounded-[24px] border border-line bg-surface p-4 shadow-float"
        >
          {content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
