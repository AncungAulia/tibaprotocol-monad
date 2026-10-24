"use client"

import { ArrowUpRight, Plus } from "lucide-react"
import { EmptyState, QueryState } from "@/components/elements/DataState"
import { formatUsdcWithUnit } from "@/lib/format"
import { receiptUrl } from "@/lib/chain"
import { usePoolHistory } from "../hooks/usePoolHistory"

export function PoolHistoryScreen() {
  const history = usePoolHistory()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline font-medium">History</h1>
        <p className="mt-1.5 text-muted-ink">Your deposits, withdrawals, and earnings</p>
      </div>
      <QueryState
        loading={history.isLoading}
        error={history.error}
        retry={() => void history.refetch()}
      >
        <section className="min-w-0 rounded-[28px] bg-surface px-4 py-2 sm:px-5">
          {!history.data?.length ? (
            <EmptyState
              title="Your first deposit starts here"
              description="Add USDC to the pool to start building your history."
            />
          ) : (
            <ul className="divide-y divide-line">
              {history.data.map((row) => {
                const deposit = row.kind === "deposit"
                return (
                  <li key={`${row.hash}-${row.index}`}>
                    <a
                      href={receiptUrl(row.hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 py-3.5"
                    >
                      <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-canvas">
                        {deposit ? (
                          <Plus size={16} aria-hidden />
                        ) : (
                          <ArrowUpRight size={16} aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{deposit ? "Deposit" : "Withdrawal"}</p>
                        <p className="truncate text-caption text-muted-ink">
                          {deposit ? "From your wallet" : "To your wallet"} · View receipt
                        </p>
                      </div>
                      <p className="shrink-0 text-right font-medium whitespace-nowrap tabular-nums">
                        {deposit ? "+" : "-"}
                        {formatUsdcWithUnit(row.amount)}
                      </p>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </QueryState>
    </div>
  )
}
