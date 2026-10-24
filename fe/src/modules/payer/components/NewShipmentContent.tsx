"use client"

import { ADVANCE_BPS, BPS } from "@tiba/sc"

import { MapPin, Route, UserPlus } from "lucide-react"
import { Button } from "@/components/elements/Button"
import { Card, TextLink } from "@/components/elements/DataState"
import { DateField } from "@/components/elements/DateField"
import { FanMeter } from "@/components/elements/FanMeter"
import { Field } from "@/components/elements/Form"
import { Initials } from "@/components/elements/PersonaAvatar"
import { KeyValue } from "@/components/elements/KeyValue"
import { RouteMap } from "@/components/elements/RouteMap"
import { SearchableSelect } from "@/components/elements/SearchableSelect"
import { TransactionStatus } from "@/components/elements/TransactionStatus"
import { formatUsdc, formatUsdcWithUnit } from "@/lib/format"
import type { Place, Relation } from "@/lib/types"

export type ShipmentFields = {
  carrier: string; pickupId: string; destinationId: string; cargo: string
  quantity: string; fee: string; due: string
}

export function NewShipmentContent({ values: v, onChange, carriers, places, pickup, destination,
  amount, remaining, creditLimit, outstanding, valid, recoveryReady, pending, step, error,
  errors, overdue, minDate, maxDate, onSubmit,
}: {
  values: ShipmentFields
  onChange: (field: keyof ShipmentFields, value: string) => void
  carriers: Relation[]; places: Place[]; pickup?: Place; destination?: Place
  amount: bigint; remaining: bigint; creditLimit: bigint; outstanding: bigint
  valid: boolean; recoveryReady: boolean; pending: boolean; step: string; error?: string
  errors: { quantity?: string; fee?: string; due?: string }
  overdue: boolean; minDate: string; maxDate: string; onSubmit: () => void
}) {
  const used = outstanding + amount
  const percent = creditLimit > 0n ? Number((used * 100n) / creditLimit) : 0
  const over = amount > remaining ? amount - remaining : 0n
  const creditAfter = remaining > amount ? remaining - amount : 0n
  const date = v.due ? new Date(`${v.due}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
  const selectedCarrier = carriers.find((r) => r.carrier_address === v.carrier)
  return (
    <form className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]"
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <Card className="space-y-5 p-5 md:p-7">
        <SearchableSelect label="Carrier" value={v.carrier} onChange={(value) => onChange("carrier", value)}
          placeholder="Choose a carrier" hint="Only carriers in your network" searchPlaceholder="Search name or plate"
          selectedLabel={selectedCarrier ? `${selectedCarrier.name ?? "Carrier"}${selectedCarrier.plate ? ` · ${selectedCarrier.plate}` : ""}` : undefined}
          options={carriers.map((r) => ({
            value: r.carrier_address, label: r.name ?? "Carrier", description: r.plate,
            leading: <Initials name={r.name ?? "Carrier"} size={32} />,
          }))}
          footer={<TextLink href="/payer/network" icon={UserPlus}>Invite a new carrier</TextLink>} />
        {!carriers.length && <TextLink href="/payer/network">Invite a carrier first</TextLink>}
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <SearchableSelect label="Pickup" value={v.pickupId} onChange={(value) => onChange("pickupId", value)}
            placeholder="Choose a pickup" searchPlaceholder="Search places"
            options={places.filter((p) => p.kind === "pickup").map((p) => ({ value: p.id, label: p.name, description: p.address, keywords: [p.address] }))} />
          <SearchableSelect label="Destination" value={v.destinationId} onChange={(value) => onChange("destinationId", value)}
            placeholder="Choose a destination" searchPlaceholder="Search places"
            options={places.filter((p) => p.kind === "destination").map((p) => ({
              value: p.id, label: p.name,
              description: `${p.address}${!p.receiver_address ? " · Receiver not linked yet" : ""}`,
              disabled: !p.receiver_address, keywords: [p.address],
              leading: <MapPin size={18} className="shrink-0 text-muted-ink" aria-hidden />,
            }))}
            footer={<TextLink href="/payer/network" icon={MapPin}>Add a new place</TextLink>} />
        </div>
        <Field label="Cargo" value={v.cargo} maxLength={200} onChange={(e) => onChange("cargo", e.target.value)}
          placeholder="e.g. 120 boxes of rice" hint="Can't be changed after you approve." required />
        <Field label="Number of boxes or items (optional)" inputMode="numeric" maxLength={7}
          value={v.quantity} onChange={(e) => onChange("quantity", e.target.value.replace(/\D/g, ""))}
          placeholder="e.g. 120" error={errors.quantity} />
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <Field label="Shipping fee" suffix="USDC" placeholder="0.00" maxLength={48} inputMode="decimal"
            value={v.fee} onChange={(e) => onChange("fee", e.target.value)}
            hint="What you pay the carrier for this trip"
            error={over > 0n && !overdue ? `That's ${formatUsdcWithUnit(over)} over your limit. Pay a bill early or lower the fee.` : errors.fee} />
          <DateField label="Due date" value={v.due} onChange={(value) => onChange("due", value)}
            min={minDate} max={maxDate} error={errors.due} hint="When you pay the bill" />
        </div>
        <TextLink href="/payer/network">Manage saved places</TextLink>
      </Card>
      <div className="min-w-0 space-y-4 lg:rounded-[28px] lg:bg-surface lg:p-6">
        <Card className="space-y-4 p-6 md:p-6 lg:p-0">
          <h2 className="text-[18px] font-medium">Summary</h2>
          {pickup && destination ? (
            <RouteMap pickup={pickup} destination={destination} className="h-[260px]" />
          ) : (
            <div className="grid justify-items-center gap-1.5 rounded-[18px] bg-canvas px-4 py-7 text-center text-label text-muted-ink">
              <Route size={28} aria-hidden />
              <p>Fill in the trip to see the numbers</p>
            </div>
          )}
          <dl className="divide-y divide-line">
            <KeyValue label="Shipping fee">{amount > 0n ? formatUsdcWithUnit(amount) : "-"}</KeyValue>
            <KeyValue label="Carrier gets on arrival">{amount > 0n ? formatUsdcWithUnit((amount * BigInt(ADVANCE_BPS)) / BigInt(BPS)) : "-"}</KeyValue>
            <KeyValue label={`You pay by${date ? ` ${date}` : ""}`}>{amount > 0n && v.due ? formatUsdcWithUnit(amount) : "-"}</KeyValue>
          </dl>
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3 text-label">
              <h3 className="font-medium">Your limit after this trip</h3>
              <span className={over > 0n ? "text-danger" : percent > 90 ? "text-warning" : "text-muted-ink"}>{creditLimit > 0n ? `${percent}%` : "No limit"}</span>
            </div>
            <FanMeter value={percent} label="Your limit after this trip" />
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-caption text-muted-ink">
              <span>{formatUsdc(used)} of {formatUsdcWithUnit(creditLimit)}</span>
              <span className={over > 0n ? "text-danger" : percent > 90 ? "text-warning" : "text-muted-ink"}>
                {formatUsdcWithUnit(over > 0n ? over : creditAfter)} {over > 0n ? "over" : "left"}
              </span>
            </div>
          </div>
        </Card>
        <div className="space-y-3">
          <Button type="submit" loading={pending} disabled={!valid || pending || !recoveryReady} className={`h-[52px] w-full ${pending ? "disabled:bg-ink disabled:text-white" : ""}`}>
            {pending ? "Waiting for wallet" : "Approve shipment"}
          </Button>
          <p className="text-center text-caption text-muted-ink">{pending ? "Approve the request in your wallet." : "Once approved, the fee and due date can't be changed."}</p>
        </div>
        {overdue && <p role="alert" className="text-danger">Repay overdue bills before creating a shipment.</p>}
        <TransactionStatus pending={pending} step={step} error={error} />
      </div>
    </form>
  )
}
