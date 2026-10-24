"use client"

import { useState } from "react"
import { BadgeCheck } from "lucide-react"
import { Modal } from "@/components/elements/Modal"
import { Button } from "@/components/elements/Button"
import { BillPaidContent, BillPaymentContent, paymentModalClassName } from "@/modules/payer/components/BillPaymentContent"
import { ShipmentDetailContent } from "@/modules/payer/components/ShipmentDetailContent"
import { scenarios } from "@/dev/preview/scenarios"

/** Static display states only: this page never calls a payment or faucet hook. */
export function PayerPaymentPreview({ initialState }: { initialState: string }) {
  const [state, setState] = useState(initialState)
  const [open, setOpen] = useState(true)
  const data = scenarios.payer
  const shipment = data.shipments!.find((s) => s.id === (state === "insufficient" ? "1043" : "1044"))!
  const pending = state === "approving" || state === "allowing"
  const paid = state === "paid"
  const transaction = {
    pending,
    step: state === "allowing" ? "1 of 2: allow this amount in your wallet" : pending ? "2 of 2: confirm the payment in your wallet" : "",
  }
  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 lg:px-10">
      <p className="text-label text-muted-ink">Payment UI preview with sample data. No transaction will be sent. Receipt links use a sample hash.</p>
      <ShipmentDetailContent shipment={shipment} onPay={() => setOpen(true)} />
      <Modal open={open} onOpenChange={setOpen} title={paid ? "Bill paid" : "Pay this bill"}
        className={`${paymentModalClassName} ${paid ? "[&>h2]:pr-0 [&>h2]:text-center [&>h2]:text-title" : ""}`}
        leading={paid ? <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-stamp"><BadgeCheck size={36} aria-hidden /></div> : undefined}>
        {paid ? <BillPaidContent shipment={shipment} account={data.pool} hash={`0x${"a".repeat(64)}`} onDone={() => setOpen(false)} />
          : <BillPaymentContent shipment={shipment} balance={data.pool?.balance} transaction={transaction} onPay={() => setState("approving")}>
            <Button variant="quiet" icon={null} disabled>Get test USDC</Button>
          </BillPaymentContent>}
      </Modal>
    </main>
  )
}
