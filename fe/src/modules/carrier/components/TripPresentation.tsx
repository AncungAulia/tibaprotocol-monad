"use client"

import { ADVANCE_BPS, BPS } from "@tiba/sc"
import * as Dialog from "@radix-ui/react-dialog"
import { QRCodeSVG } from "qrcode.react"
import { ArrowDownToLine, Check, CircleCheck, LoaderCircle, X } from "lucide-react"
import type { Shipment } from "@/lib/types"
import { formatUsdcWithUnit } from "@/lib/format"
import { receiptUrl } from "@/lib/chain"
import { Amount } from "@/components/elements/Amount"
import { Button, ButtonLink } from "@/components/elements/Button"
import { Card } from "@/components/elements/DataState"
import { KeyValue } from "@/components/elements/KeyValue"

export const tripTitle = (s: Shipment) =>

  `${s.trip?.pickup?.name ?? "Pickup"} to ${s.trip?.destination?.name ?? "Destination"}`

export function TripFacts({ shipment: s }: { shipment: Shipment }) {

  return (

    <Card className="p-6 md:p-6">

      <h2 className="mb-1 text-heading font-medium">Trip</h2>

      <dl className="divide-y divide-line">

        {s.trip?.payer_name && <KeyValue label="Shipping company">{s.trip.payer_name}</KeyValue>}

        {s.trip?.pickup && <KeyValue label="Pickup">{s.trip.pickup.name}, {s.trip.pickup.address}</KeyValue>}

        {s.trip?.destination && <KeyValue label="Drop-off">{s.trip.destination.name}, {s.trip.destination.address}</KeyValue>}

        {s.trip?.cargo && <KeyValue label="Cargo">{s.trip.cargo}</KeyValue>}

        <KeyValue label="Shipping fee">{formatUsdcWithUnit(s.amount)}</KeyValue>

      </dl>

    </Card>

  )

}

export function ReadyToGetPaid({ shipment: s, pending = false, onPay }: {

  shipment: Shipment; pending?: boolean; onPay?: () => void

}) {

  return (

    <Card className="space-y-3 bg-stamp p-6 md:p-6">

      <h2 className="flex items-start gap-2 text-body font-medium">

        <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />

        {s.trip?.destination?.name ?? "The warehouse"} confirmed {s.receivedQty > 0 ? `${s.receivedQty} items` : "your delivery"}

      </h2>

      <Amount size="hero" value={(s.amount * BigInt(ADVANCE_BPS)) / BigInt(BPS)} />

      <p className="text-label leading-relaxed">

        {onPay ? <>Ready for you now. {s.trip?.payer_name ?? "Your shipping company"} pays the rest on {new Date(Number(s.dueDate) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</> : <>{(ADVANCE_BPS / BPS) * 100}% of {formatUsdcWithUnit(s.amount)} · #{s.id} {tripTitle(s)}</>}

      </p>

      {onPay ? (

        <Button icon={ArrowDownToLine} className="w-full disabled:bg-ink disabled:text-white" loading={pending} onClick={onPay}>

          {pending ? "Waiting for wallet" : "Get paid now"}

        </Button>

      ) : (

        <ButtonLink icon={ArrowDownToLine} className="w-full" href={`/carrier/trips/${s.id}`}>Get paid now</ButtonLink>

      )}

      {pending && <p role="status" className="text-center text-caption">Approve it in your wallet.</p>}

    </Card>

  )

}

export function TripQR({ shipment: s, open, onOpenChange }: {

  shipment: Shipment; open: boolean; onOpenChange: (open: boolean) => void

}) {

  return (

    <Dialog.Root open={open} onOpenChange={onOpenChange}>

      <Dialog.Portal>

        <Dialog.Overlay className="fixed inset-0 z-40 bg-surface" />

        <Dialog.Content className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface p-4 md:p-10">

          <Dialog.Close className="flex min-h-11 w-fit items-center gap-2 text-label"><X size={18} aria-hidden /> Close</Dialog.Close>

          <div className="mx-auto my-auto flex w-full max-w-sm flex-col items-center gap-5 py-8 text-center">

            <Dialog.Title className="text-heading font-medium">Show this to {s.trip?.destination?.name ?? "the warehouse"}</Dialog.Title>

            <Dialog.Description className="text-label text-muted-ink">They scan it to confirm the goods arrived.</Dialog.Description>

            <div className="w-full max-w-[340px] rounded-[32px] border border-line bg-surface p-6 shadow-float">

              <QRCodeSVG value={`${typeof window === "undefined" ? "" : window.location.origin}/confirm/${s.id}`} size={320} marginSize={2} className="h-auto w-full" />

            </div>

            <p className="text-label">Shipment #{s.id}{s.trip?.cargo ? ` · ${s.trip.cargo}` : ""}</p>

            <p role="status" className="flex items-center gap-2 rounded-full bg-canvas px-4 py-2 text-caption"><LoaderCircle size={14} aria-hidden /> Waiting for them to scan</p>

            <p className="text-caption text-muted-ink">Turn your screen brightness up if the scan is slow.</p>

            <p className="text-caption text-muted-ink">{s.trip?.code && /^[A-Z0-9]{6}$/i.test(s.trip.code) ? `Backup code: ${s.trip.code}` : "Backup code unavailable"}</p>

          </div>

        </Dialog.Content>

      </Dialog.Portal>

    </Dialog.Root>

  )

}

export function TripPaid({ amount, hash, direct }: { amount: bigint; hash?: string; direct: boolean }) {

  return (

    <div className="@container fixed inset-0 z-30 flex overflow-y-auto bg-stamp p-4 md:p-10">

      <div className="m-auto flex w-full max-w-sm flex-col items-center gap-4 py-8 text-center">

        <span className="grid size-[88px] place-items-center rounded-full bg-ink text-stamp"><Check size={36} aria-hidden /></span>

        <h1 className="text-heading font-medium">You got paid</h1>

        <Amount size="hero" value={amount} />

        <p className="text-label">{direct ? "Your shipping company paid you directly." : "Your payment has been sent to your wallet."}</p>

        <div className="mt-3 flex w-full items-center gap-3 rounded-[18px] bg-surface px-4 py-3 text-left">

          <CircleCheck size={24} className="shrink-0 text-success" aria-hidden />

          <div><p className="text-label font-medium">Payment received</p>{hash && <a className="text-caption text-stamp-deep underline" href={receiptUrl(hash)} target="_blank" rel="noreferrer">View receipt</a>}</div>

        </div>

        <ButtonLink href="/carrier" className="w-full">Back to trips</ButtonLink>

      </div>

    </div>

  )

}

