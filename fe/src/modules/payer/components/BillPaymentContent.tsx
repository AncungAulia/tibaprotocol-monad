import type { ComponentProps, ReactNode } from "react"
import { BadgeCheck, Check, CircleAlert, Wallet } from "lucide-react"
import { Amount } from "@/components/elements/Amount"
import { Button } from "@/components/elements/Button"
import { KeyValue } from "@/components/elements/KeyValue"
import { TransactionStatus } from "@/components/elements/TransactionStatus"
import { formatUsdcWithUnit } from "@/lib/format"
import type { Shipment } from "@/lib/types"

export const paymentModalClassName = "inset-x-2 bottom-2 rounded-[32px] p-5 pb-[max(28px,env(safe-area-inset-bottom))] md:w-[440px] md:rounded-[28px] md:p-7 [&>h2]:text-heading [&>div:last-child]:mt-4"

export function BillPaymentContent({ shipment: s, balance, transaction, onPay, children }: {
  shipment: Shipment
  balance?: bigint
  transaction: ComponentProps<typeof TransactionStatus>
  onPay: () => void
  children?: ReactNode
}) {
  const { pending, step } = transaction
  const shortfall = balance !== undefined && balance < s.amount ? s.amount - balance : 0n
  const days = Math.ceil((Number(s.dueDate) * 1000 - Date.now()) / 86400000)
  const allowing = step.startsWith("1 of 2:")
  const sending = step.startsWith("2 of 2:") || step === "Waiting for confirmation"
  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-canvas px-5 py-[18px]">
        <p className="text-label text-muted-ink">Shipment #{s.id} · due {new Date(Number(s.dueDate) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
        <p className="mt-1"><Amount value={s.amount} size="hero" className="text-[clamp(2rem,10cqi,2.25rem)]" /></p>
        {days > 0 && <p className="mt-1 text-caption text-success">Paying {days} {days === 1 ? "day" : "days"} early</p>}
      </div>
      <div className={`flex items-center gap-3 rounded-[18px] border px-3.5 py-3 ${shortfall ? "border-danger" : "border-line"}`}>
        <Wallet className="size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">From your wallet</p>
          <p className={`text-caption ${shortfall ? "text-danger" : "text-muted-ink"}`}>{balance !== undefined ? `${formatUsdcWithUnit(balance)} available` : "Balance unavailable"}</p>
        </div>
      </div>
      {pending && (allowing || sending) && (
        <ol aria-label="Wallet approvals" className="space-y-2.5">
          {[
            ["Allow the payment", sending ? "Done in your wallet" : "Approve it in your wallet"],
            [`Send ${formatUsdcWithUnit(s.amount)}`, step === "Waiting for confirmation" ? "Waiting for confirmation" : "Approve it in your wallet"],
          ].map(([title, detail], index) => {
            const current = allowing ? index === 0 : index === 1
            const done = sending && index === 0
            return (
              <li key={title} aria-current={current ? "step" : undefined} className={`flex items-center gap-3 rounded-[18px] px-3.5 py-3 ${current ? "bg-stamp-soft" : "bg-canvas"}`}>
                <span className={`grid size-[26px] shrink-0 place-items-center rounded-full ${done ? "bg-ink text-white" : current ? "bg-stamp" : "border border-line-strong"}`}>
                  {done ? <Check size={14} aria-hidden /> : <span className="text-caption">{index + 1}</span>}
                </span>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-medium">{title}</p>
                  <p className="text-caption text-muted-ink">{detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {shortfall > 0n && !pending && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[18px] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-4 py-3.5 text-[13.5px]">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p>You need {formatUsdcWithUnit(shortfall)} more. Add USDC to your wallet, then try again.</p>
        </div>
      )}
      <Button block loading={pending} disabled={pending || balance === undefined || shortfall > 0n}
        onClick={onPay} className={`h-[52px] w-full ${pending ? "disabled:bg-ink disabled:text-white" : ""}`}>
        {pending ? "Waiting for wallet" : `Pay ${formatUsdcWithUnit(s.amount)}`}
      </Button>
      {shortfall > 0n && !pending ? children : (
        <p className="text-caption text-muted-ink">
          {pending ? "Your wallet may ask twice: first allow this amount, then confirm payment." : s.advanced > 0n ? "Investors get paid back, and your limit frees up right away." : "Your payment goes straight to the carrier."}
        </p>
      )}
      <TransactionStatus {...transaction} />
    </div>
  )
}

export function BillPaidContent({ shipment: s, account, hash, onDone }: {
  shipment: Shipment
  account?: { creditLimit: bigint; outstanding: bigint; repaidCount: bigint; lateCount: bigint }
  hash: string
  onDone: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-center text-[14px] text-muted-ink">{s.trip?.payer_name ?? "You"} paid {formatUsdcWithUnit(s.amount)}.</p>
      {account && (
        <dl className="divide-y divide-line rounded-[18px] bg-canvas px-4 py-1">
          <KeyValue label="Credit limit left">{formatUsdcWithUnit(account.creditLimit > account.outstanding ? account.creditLimit - account.outstanding : 0n)}</KeyValue>
          {account.repaidCount > 0n && <KeyValue label="Paid on time">{Number(((account.repaidCount - account.lateCount) * 100n) / account.repaidCount)}% · {account.repaidCount - account.lateCount} of {account.repaidCount} bills</KeyValue>}
        </dl>
      )}
      <div className="flex items-center gap-3 rounded-[18px] bg-canvas px-4 py-3">
        <BadgeCheck className="size-8 shrink-0 rounded-full bg-success/10 p-1.5 text-success" aria-hidden />
        <div className="min-w-0">
          <p className="text-label font-medium">Payment sent</p>
          <TransactionStatus pending={false} step="Confirmed" hash={hash} />
        </div>
      </div>
      <Button onClick={onDone} className="h-[52px] w-full">Done</Button>
    </div>
  )
}
