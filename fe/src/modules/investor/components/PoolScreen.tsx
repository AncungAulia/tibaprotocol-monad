"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowDownToLine, ArrowUpRight, Info, PackageCheck, Plus } from "lucide-react"
import { Card, EmptyState, QueryState, TextLink } from "@/components/elements/DataState"
import { Button } from "@/components/elements/Button"
import { Amount } from "@/components/elements/Amount"
import { FanMeter } from "@/components/elements/FanMeter"
import { usePoolAccount, useShipments, useTransaction } from "@/lib/ledger"
import { useProfile } from "@/lib/queries"
import { formatUsdc, formatUsdcWithUnit, parseUsdc } from "@/lib/format"
import { amountError } from "@/lib/validation"
import { Status } from "@/lib/contracts"
import { financingBreakdown, poolEarnLabel, sharesForWithdrawal } from "../data/math"
import { usePoolHistory } from "../hooks/usePoolHistory"
import { PoolMoneyDialog, type MoneyMode } from "./PoolMoneyDialog"

const shortDate = (seconds: bigint) =>
  new Date(Number(seconds) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })

export function PoolScreen() {
  const account = usePoolAccount()
  const shipments = useShipments()
  const history = usePoolHistory()
  const profile = useProfile()
  const tx = useTransaction()
  const [mode, setMode] = useState<MoneyMode | null>(null)
  const [amount, setAmount] = useState("")
  const [done, setDone] = useState<{ mode: MoneyMode; amount: bigint } | null>(null)
  const data = account.data
  const maximum =
    mode === "deposit"
      ? (data?.balance ?? 0n)
      : data
        ? data.maxWithdraw < data.value
          ? data.maxWithdraw
          : data.value
        : 0n
  const validation = amountError(amount, maximum)
  const raw = validation ? 0n : parseUsdc(amount)
  const shares = data ? sharesForWithdrawal(raw, data.totalAssets, data.totalShares) : 0n
  const withdrawPreview =
    data && data.totalShares > 0n
      ? (shares * (data.totalAssets + 1n)) / (data.totalShares + 1n)
      : 0n
  const paidEarly = data
    ? data.totalAssets > data.available
      ? data.totalAssets - data.available
      : 0n
    : 0n
  const utilization = data?.totalAssets ? Number((paidEarly * 10000n) / data.totalAssets) / 100 : 0
  const share = data?.totalShares ? Number((data.shares * 10000n) / data.totalShares) / 100 : 0
  const added = history.data
    ?.filter((row) => row.kind === "deposit")
    .reduce((sum, row) => sum + row.amount, 0n)
  const taken = history.data
    ?.filter((row) => row.kind === "withdraw")
    .reduce((sum, row) => sum + row.amount, 0n)
  const earned =
    data && added !== undefined && taken !== undefined ? data.value + taken - added : undefined
  const financed = shipments.data?.filter((row) => row.status === Status.FINANCED) ?? []
  const repaid =
    shipments.data?.filter((row) => row.status === Status.REPAID && row.advanced > 0n) ?? []
  const poolEarned = repaid.reduce(
    (sum, row) => sum + financingBreakdown(row.amount, row.advanced).pool,
    0n,
  )
  const owedTotal = financed.reduce((sum, row) => sum + row.amount, 0n)
  const companies = [...new Set(financed.map((row) => row.payer.toLowerCase()))].map((payer) => {
    const bills = financed.filter((row) => row.payer.toLowerCase() === payer)
    return {
      payer,
      name: bills.find((row) => row.trip?.payer_name)?.trip?.payer_name ?? "Shipping company",
      bills: bills.length,
      amount: bills.reduce((sum, row) => sum + row.amount, 0n),
    }
  })
  const overdue = financed.filter((row) => Number(row.dueDate) * 1000 + 60000 < Date.now())
  const nextDue = financed
    .map((row) => row.dueDate)
    .filter((due) => Number(due) * 1000 > Date.now())
    .sort((a, b) => (a < b ? -1 : 1))[0]
  const firstVisit = !!data && data.value === 0n && data.shares === 0n
  const poolBusy = !!data && (utilization >= 75 || data.maxWithdraw < data.value)
  const name = profile.data?.name

  function open(next: MoneyMode) {
    tx.reset()
    setAmount("")
    setDone(null)
    setMode(next)
  }
  function close() {
    setMode(null)
    setDone(null)
    setAmount("")
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline font-medium">
          {firstVisit ? "Welcome" : "Hi"}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1.5 text-muted-ink">
          {firstVisit
            ? "Here's how the pool works before you put money in"
            : "Your money pays truck owners early"}
        </p>
      </div>
      <QueryState
        loading={account.isLoading}
        error={account.error}
        retry={() => void account.refetch()}
      >
        {data && (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <section className="@container flex min-w-0 flex-col gap-3.5 rounded-[28px] bg-ink p-6 text-white">
                <h2 className="text-label text-white/70">Your money in the pool</h2>
                <Amount value={data.value} size="hero" />
                <p className="text-label text-stamp">
                  {firstVisit
                    ? "Deposit USDC to start earning"
                    : [
                        added !== undefined && taken !== undefined
                          ? `${formatUsdc(added - taken > 0n ? added - taken : 0n)} deposited`
                          : undefined,
                        earned !== undefined
                          ? `${formatUsdc(earned > 0n ? earned : 0n)} earned`
                          : undefined,
                        `${Number(share.toFixed(2))}% of the pool`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                <div className="mt-auto flex flex-col gap-2.5 pt-2 @min-[441px]:flex-row">
                  <Button
                    variant="moment"
                    icon={Plus}
                    onClick={() => open("deposit")}
                    className="w-full @min-[441px]:w-fit"
                  >
                    Deposit
                  </Button>
                  {!firstVisit && (
                    <Button
                      variant="secondary"
                      icon={ArrowDownToLine}
                      onClick={() => open("withdraw")}
                      className="w-full @min-[441px]:w-fit"
                      disabled={data.value === 0n}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </section>
              <section className="@container flex min-w-0 flex-col gap-4 rounded-[28px] bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-medium">The pool</h2>
                  <span className="text-label font-medium text-muted-ink">
                    {Math.round(utilization)}% paid out
                  </span>
                </div>
                <div className="space-y-1">
                  <Amount value={data.totalAssets} className="[&>span:last-child]:text-ink" />
                  <p className="text-label text-muted-ink">
                    {formatUsdc(paidEarly)} paid out early · {formatUsdc(data.available)} available
                  </p>
                </div>
                <FanMeter
                  value={utilization}
                  label="Pool funds paid out early"
                  size="lg"
                  legend={["Paid out early", "Available"]}
                />
                {poolBusy && (
                  <p className="flex gap-2.5 rounded-2xl bg-stamp-soft px-4 py-3.5 text-label">
                    <Info size={18} className="mt-0.5 shrink-0 text-stamp-deep" aria-hidden />
                    <span>
                      Most of the pool is working right now. Withdrawals over{" "}
                      {formatUsdcWithUnit(data.available)} wait until companies pay their bills.
                    </span>
                  </p>
                )}
              </section>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Stat
                label="Earned by the pool"
                value={shipments.isError ? "Unavailable" : formatUsdcWithUnit(poolEarned)}
                context={`${poolEarnLabel()} of each bill`}
              />
              <Stat
                label="Missed payments"
                value={shipments.isError ? "Unavailable" : String(overdue.length)}
                context={`Out of ${financed.length + repaid.length} trips`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-6 md:p-6">
                <h2 className="text-heading font-medium">Owed by each company</h2>
                {shipments.isError ? (
                  <p role="alert" className="mt-4 text-danger">
                    Company balances are unavailable. Please try again.
                  </p>
                ) : !companies.length ? (
                  <EmptyState
                    title="Ready for the next delivery"
                    description="Companies appear here when carriers receive an early payment."
                  />
                ) : (
                  <ul className="mt-5 space-y-5">
                    {companies.map((company) => {
                      const pct = owedTotal
                        ? Number((company.amount * 10000n) / owedTotal) / 100
                        : 0
                      return (
                        <li key={company.payer} className="space-y-2.5">
                          <div className="flex items-center justify-between gap-3 text-label">
                            <span className="min-w-0 truncate font-medium">{company.name}</span>
                            <span className="text-muted-ink">{Math.round(pct)}%</span>
                          </div>
                          <FanMeter value={pct} label={`${company.name} share of money owed`} />
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption">
                            <span className="text-muted-ink">
                              {formatUsdcWithUnit(company.amount)} owed
                            </span>
                            <span className="font-medium">
                              {company.bills} {company.bills === 1 ? "bill" : "bills"} open
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
              <Card className="px-5 pt-5 pb-2.5 md:px-5 md:pt-5 md:pb-2.5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-heading font-medium">Latest</h2>
                  <TextLink href="/pool/history">See all</TextLink>
                </div>
                {history.isError ? (
                  <p className="py-4 text-muted-ink">
                    Your payment history is unavailable. Your current balance above is still read
                    directly from the pool.
                  </p>
                ) : history.isLoading ? (
                  <p role="status" className="py-4 text-muted-ink">
                    Loading activity...
                  </p>
                ) : !history.data?.length ? (
                  <EmptyState
                    title="Make your first deposit"
                    description="Your recent payments will appear here."
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {history.data.slice(0, 3).map((row) => (
                      <li key={`${row.hash}-${row.index}`} className="flex items-center gap-3 py-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas">
                          {row.kind === "deposit" ? (
                            <Plus size={16} aria-hidden />
                          ) : (
                            <ArrowUpRight size={16} aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {row.kind === "deposit" ? "You deposited" : "You withdrew"}
                          </p>
                          <p className="text-caption text-muted-ink">
                            {formatUsdcWithUnit(row.amount)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {financed.length > 0 && (
                  <Link
                    href="/pool/deliveries"
                    className="flex items-center gap-3 border-t border-line py-3"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas">
                      <PackageCheck size={16} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 font-medium">
                      {financed.length} {financed.length === 1 ? "delivery" : "deliveries"} waiting
                      to be repaid
                    </span>
                    <ArrowUpRight size={16} className="shrink-0 text-muted-ink" aria-hidden />
                  </Link>
                )}
              </Card>
            </div>
          </>
        )}
      </QueryState>
      <PoolMoneyDialog
        mode={mode}
        amount={amount}
        setAmount={setAmount}
        maximum={maximum}
        balance={data?.balance ?? 0n}
        busy={mode === "withdraw" && !!data && data.maxWithdraw < data.value}
        nextFree={nextDue ? shortDate(nextDue) : undefined}
        pending={tx.pending}
        step={tx.step}
        error={tx.error}
        canSubmit={!validation && !tx.pending && !!data && !(mode === "withdraw" && shares === 0n)}
        sendAmount={mode === "withdraw" ? withdrawPreview : raw}
        done={done}
        after={data ? { value: data.value, share } : undefined}
        onClose={close}
        onSubmit={() => {
          if (!mode) return
          const sent = mode === "withdraw" ? withdrawPreview : raw
          const action = mode
          void tx
            .run(mode, { amount: mode === "withdraw" ? shares : raw })
            .then(() => {
              setDone({ mode: action, amount: sent })
              setAmount("")
            })
            .catch(() => {})
        }}
      />
    </div>
  )
}

function Stat({ label, value, context }: { label: string; value: string; context: string }) {
  return (
    <section className="min-w-0 space-y-1.5 rounded-[22px] bg-surface p-5">
      <h2 className="text-label text-muted-ink">{label}</h2>
      <p className="text-[clamp(24px,3vw,32px)] leading-tight font-medium tracking-[-0.03em] tabular-nums [overflow-wrap:anywhere]">
        {value}
      </p>
      <p className="text-caption text-muted-ink">{context}</p>
    </section>
  )
}
