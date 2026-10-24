"use client"

import { useState } from "react"
import { ArrowLeft, BadgeCheck } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { usePoolAccount, useShipments, useTransaction } from "@/lib/ledger"
import { Card, EmptyState, QueryState, TextLink } from "@/components/elements/DataState"
import { Modal } from "@/components/elements/Modal"
import { TransactionStatus } from "@/components/elements/TransactionStatus"
import { FaucetButton } from "@/modules/wallet/components/WalletButton"
import { ShipmentDetailContent } from "./ShipmentDetailContent"
import { BillPaidContent, BillPaymentContent, paymentModalClassName } from "./BillPaymentContent"

export function ShipmentDetailScreen({ id }: { id: string }) {
  const { address } = useAuth(),
    query = useShipments(),
    account = usePoolAccount(),
    tx = useTransaction()
  const [open, setOpen] = useState(false),
    [attemptId, setAttemptId] = useState<string>()
  const s = query.data?.find(
    (row) => row.id === id && row.payer.toLowerCase() === address?.toLowerCase(),
  )
  const paid = attemptId === id && !!tx.hash && !tx.pending && !tx.error
  async function pay() {
    if (!s) return
    setAttemptId(id)
    try {
      await tx.run("repay", { id: s.id, amount: s.amount })
    } catch {}
  }
  return (
    <div className="space-y-4 lg:space-y-6">
      <TextLink href="/payer/shipments" icon={ArrowLeft} className="min-h-0 flex-row-reverse text-[14px] text-muted-ink">
        Shipments
      </TextLink>
      <QueryState loading={query.isLoading} error={query.error} retry={() => query.refetch()}>
        {!s ? (
          <Card>
            <EmptyState title="Shipment not found" description="This shipment is unavailable or belongs to another company." />
          </Card>
        ) : (
          <>
            <ShipmentDetailContent shipment={s}
              onPay={() => {
                tx.reset()
                setAttemptId(undefined)
                setOpen(true)
              }}
              feedback={attemptId === id && !open ? <TransactionStatus {...tx} /> : undefined}
            />
            <Modal open={open}
              onOpenChange={(value) => { if (!tx.pending) setOpen(value) }}
              title={paid ? "Bill paid" : "Pay this bill"}
              className={`${paymentModalClassName} ${paid ? "[&>h2]:pr-0 [&>h2]:text-center [&>h2]:text-title" : ""}`}
              leading={paid ? <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-stamp"><BadgeCheck size={36} aria-hidden /></div> : undefined}
            >
              {paid && tx.hash ? (
                <BillPaidContent shipment={s} hash={tx.hash}
                  account={account.error ? undefined : account.data}
                  onDone={() => setOpen(false)} />
              ) : (
                <QueryState loading={account.isLoading} error={account.error} retry={() => account.refetch()}>
                  <BillPaymentContent shipment={s} balance={account.data?.balance}
                    transaction={attemptId === id ? tx : { pending: false, step: "" }} onPay={pay}>
                    <FaucetButton />
                  </BillPaymentContent>
                </QueryState>
              )}
            </Modal>
          </>
        )}
      </QueryState>
    </div>
  )
}
