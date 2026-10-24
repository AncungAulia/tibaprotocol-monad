"use client"

import { formatUnits } from "viem"
import { BadgeCheck, Check, Info, LoaderCircle, Wallet } from "lucide-react"
import { Button } from "@/components/elements/Button"
import { Modal } from "@/components/elements/Modal"
import { formatUsdc, formatUsdcWithUnit, parseUsdc } from "@/lib/format"
import { amountError } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { FaucetButton } from "@/modules/wallet/components/WalletButton"
import { poolEarnLabel } from "../data/math"

export type MoneyMode = "deposit" | "withdraw"

/** Deposit and withdraw sheet (Pencil I2.1 to I2.7). Transaction logic stays in PoolScreen. */
export function PoolMoneyDialog({
  mode,
  amount,
  setAmount,
  maximum,
  balance,
  busy,
  nextFree,
  pending,
  step,
  error,
  canSubmit,
  sendAmount,
  done,
  after,
  onSubmit,
  onClose,
}: {
  mode: MoneyMode | null
  amount: string
  setAmount: (value: string) => void
  /** Most the user can deposit (wallet) or withdraw (free money) right now. */
  maximum: bigint
  /** Wallet USDC balance. */
  balance: bigint
  /** Withdraw only: part of the user's money is paying carriers right now. */
  busy: boolean
  /** Next date a financed bill is due, when some money frees up. */
  nextFree?: string
  pending: boolean
  step: string
  error?: string
  canSubmit: boolean
  /** Amount the button sends (withdraw: after share rounding). */
  sendAmount: bigint
  /** Set after a confirmed transaction: shows the success state. */
  done: { mode: MoneyMode; amount: bigint } | null
  /** Pool position after the transaction, for the success rows. */
  after?: { value: bigint; share: number }
  onSubmit: () => void
  onClose: () => void
}) {
  const deposit = mode === "deposit"
  const parsed = amount && amountError(amount) === undefined ? parseUsdc(amount) : undefined
  const tooMuch = parsed !== undefined && parsed > maximum
  const formatError = amount ? amountError(amount) : undefined
  const title = deposit ? "Deposit" : "Withdraw"
  const firstStepDone = !step.startsWith("1 of 2")

  return (
    <Modal
      open={mode !== null}
      onOpenChange={(value) => {
        if (!value && !pending) onClose()
      }}
      title={done ? (done.mode === "deposit" ? "Deposit received" : "Withdrawn") : title}
    >
      {done ? (
        <div className="space-y-4">
          <span className="grid size-20 place-items-center rounded-full bg-stamp">
            <BadgeCheck size={34} aria-hidden />
          </span>
          <p className="text-amount font-medium tracking-[-0.035em] tabular-nums">
            {formatUsdcWithUnit(done.amount)}
          </p>
          <p className="text-muted-ink">
            {done.mode === "deposit"
              ? "It starts paying truck owners on the next delivery."
              : "Sent to your wallet in under a second."}
          </p>
          {after && (
            <dl className="rounded-[18px] bg-canvas px-4 py-1">
              <div className="flex justify-between gap-3 border-b border-line py-3">
                <dt className="text-muted-ink">Your money in the pool</dt>
                <dd className="text-right font-medium">{formatUsdcWithUnit(after.value)}</dd>
              </div>
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-muted-ink">Your share</dt>
                <dd className="font-medium">{Number(after.share.toFixed(2))}%</dd>
              </div>
            </dl>
          )}
          <Button block onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pool-amount" className="block text-label font-medium">
              Amount
            </label>
            <div
              className={cn(
                "flex h-16 items-center gap-3 rounded-[18px] border px-[18px] focus-within:ring-2 focus-within:ring-ring",
                tooMuch || formatError ? "border-danger bg-surface" : "border-canvas bg-canvas",
              )}
            >
              <input
                id="pool-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                disabled={pending}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={tooMuch || !!formatError}
                aria-describedby="pool-amount-hint"
                className="min-w-0 flex-1 bg-transparent text-[26px] font-medium tabular-nums outline-none placeholder:text-muted-ink"
              />
              <span className="shrink-0 text-muted-ink">USDC</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {([25, 50, 100] as const).map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={pending}
                  onClick={() => setAmount(formatUnits((maximum * BigInt(pct)) / 100n, 6))}
                  className="min-h-9 rounded-full bg-canvas px-3 text-caption font-medium hover:bg-subtle"
                >
                  {pct === 100 ? (busy ? "Max now" : "Max") : `${pct}%`}
                </button>
              ))}
            </div>
            {!pending && (
              <p
                id="pool-amount-hint"
                aria-live="polite"
                className={cn(
                  "text-caption",
                  tooMuch || formatError ? "text-danger" : "text-muted-ink",
                )}
              >
                {formatError
                  ? formatError
                  : tooMuch
                    ? deposit
                      ? `That's more than your wallet has. You can deposit up to ${formatUsdcWithUnit(maximum)}.`
                      : `Only ${formatUsdcWithUnit(maximum)} is free right now. The rest is paying truck owners and comes back as companies pay${nextFree ? `, next on ${nextFree}` : ""}.`
                    : deposit
                      ? `Your money pays truck owners early. You earn ${poolEarnLabel()} of each bill when it's paid.`
                      : `You can withdraw up to ${formatUsdcWithUnit(maximum)} right now.`}
              </p>
            )}
          </div>

          {pending && deposit ? (
            <ol className="space-y-2.5">
              <PendingStep
                done={firstStepDone}
                title="Allow the deposit"
                note={firstStepDone ? "Done in your wallet" : "Approve it in your wallet"}
              />
              <PendingStep
                active={firstStepDone}
                title={`Send ${formatUsdcWithUnit(sendAmount)}`}
                note={firstStepDone ? "Approve it in your wallet" : "Next"}
              />
            </ol>
          ) : !deposit && busy && tooMuch ? (
            <p className="flex gap-2.5 rounded-2xl bg-stamp-soft px-4 py-3.5 text-label">
              <Info size={18} className="mt-0.5 shrink-0 text-stamp-deep" aria-hidden />
              <span>Withdraw {formatUsdc(maximum)} now, and the rest when it frees up.</span>
            </p>
          ) : (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3.5 py-3",
                deposit && tooMuch ? "border-danger" : "border-line",
              )}
            >
              <Wallet size={18} className="shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">{deposit ? "From your wallet" : "To your wallet"}</p>
                <p
                  className={cn(
                    "text-caption",
                    deposit && tooMuch ? "text-danger" : "text-muted-ink",
                  )}
                >
                  {deposit
                    ? `${formatUsdcWithUnit(balance)} available`
                    : "Arrives in under a second"}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="break-words text-danger">
              {error}
            </p>
          )}

          <Button block loading={pending} disabled={!canSubmit} onClick={onSubmit}>
            {pending
              ? "Waiting for wallet"
              : canSubmit && sendAmount > 0n
                ? `${title} ${formatUsdcWithUnit(sendAmount)}`
                : title}
          </Button>
          {pending && deposit && (
            <p className="text-caption text-muted-ink">
              Two quick approvals. The first one only happens once.
            </p>
          )}
          {deposit && tooMuch && <FaucetButton />}
        </div>
      )}
    </Modal>
  )
}

function PendingStep({
  done,
  active,
  title,
  note,
}: {
  done?: boolean
  active?: boolean
  title: string
  note: string
}) {
  const current = !done && active !== false
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3.5 py-3",
        current && !done ? "bg-stamp-soft" : "bg-canvas",
      )}
    >
      <span
        className={cn(
          "grid size-[26px] shrink-0 place-items-center rounded-full",
          done ? "bg-ink text-white" : current ? "bg-stamp text-ink" : "bg-line text-muted-ink",
        )}
      >
        {done ? (
          <Check size={14} aria-hidden />
        ) : (
          <LoaderCircle
            size={14}
            className={current ? "motion-safe:animate-spin" : undefined}
            aria-hidden
          />
        )}
      </span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-caption text-muted-ink">{note}</p>
      </div>
    </li>
  )
}
