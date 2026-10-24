"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleX,
  Info,
  PackageX,
  ScanLine,
  Send,
} from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { useShipments, useTransaction } from "@/lib/ledger"
import { useProfile } from "@/lib/queries"
import { Status } from "@/lib/contracts"
import { api } from "@/lib/api"
import { receiptUrl } from "@/lib/chain"
import { reportRequest } from "@/lib/requests"
import { errorMessage } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { Button, ButtonLink } from "@/components/elements/Button"
import { Field, inputClass } from "@/components/elements/Form"
import { Card, QueryState } from "@/components/elements/DataState"
import { StatusChip } from "@/components/elements/StatusChip"
import { TransactionStatus } from "@/components/elements/TransactionStatus"
import { quantityError } from "../data/validation"
import { issueLabels } from "../data/report"
import { cargoText, dayTime, hubName } from "../data/display"
import { WarehouseIllustration, WarehouseResult } from "./WarehouseResult"

type Report = { shipment_id: string; issues: string[]; received_qty: number; note: string }
const issues = ["Damaged", "Missing items", "Wrong goods", "Other"]

/** Narrow centered column used by every step of this flow. */
function Column({
  back,
  title,
  description,
  children,
}: {
  back: ReactNode
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-4 md:gap-5">
      <div className="grid gap-1">
        {back}
        <h1 className="text-headline font-medium [overflow-wrap:anywhere]">{title}</h1>
        {description && (
          <p className="text-body text-muted-ink [overflow-wrap:anywhere]">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

const backClass =
  "inline-flex min-h-11 w-fit items-center gap-1.5 text-label text-muted-ink hover:text-ink"

function KeyValue({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === "") return null
  return (
    <div className="flex items-start justify-between gap-4 border-line py-3 not-first:border-t">
      <dt className="shrink-0 text-label text-muted-ink">{label}</dt>
      <dd className="min-w-0 text-right text-label font-medium [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  )
}

export function ConfirmArrivalScreen({ id }: { id: string }) {
  const { address, getAccessToken } = useAuth()
  const query = useShipments()
  const profile = useProfile()
  const transaction = useTransaction()
  const shipment = query.data?.find((s) => s.id === id)
  const mine = !!shipment && shipment.consignee.toLowerCase() === address?.toLowerCase()
  const [problem, setProblem] = useState(false)
  const [picked, setPicked] = useState<string[]>(["Damaged"])
  const [quantity, setQuantity] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [complete, setComplete] = useState(false)
  const [completedAt, setCompletedAt] = useState<number>()
  const [report, setReport] = useState<Report>()
  const [confirmed, setConfirmed] = useState(false)
  const busy = useRef(false)
  const storageKey = `tiba:arrival-report:${address?.toLowerCase()}:${id}`
  useEffect(() => {
    setReport(undefined)
    setConfirmed(false)
    setComplete(false)
    setProblem(false)
    setQuantity("")
    setNote("")
    setError(undefined)
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return
      const data: Report = JSON.parse(stored)
      if (
        data.shipment_id === id &&
        Array.isArray(data.issues) &&
        data.issues.every((item) => issues.includes(item)) &&
        !quantityError(String(data.received_qty)) &&
        typeof data.note === "string"
      )
        setReport(data)
    } catch {
      /* The user can still submit a report from the delivery details. */
    }
  }, [storageKey, id])
  useEffect(() => {
    if (complete) setCompletedAt(Date.now())
  }, [complete])
  const expected = shipment?.trip?.quantity ?? undefined
  const received = quantity || (!problem && expected !== undefined ? String(expected) : "")
  const qtyError = quantityError(received, expected)
  const canConfirm = mine && shipment?.status === Status.IN_TRANSIT && !confirmed && !complete
  async function saveReport(data: Report) {
    if (data.shipment_id !== id) throw new Error("This report belongs to another shipment.")
    await api("/api/reports", {
      method: "POST",
      token: await getAccessToken(),
      walletAddress: address,
      body: reportRequest(data),
    })
    localStorage.removeItem(storageKey)
    setReport(undefined)
    setComplete(true)
    void query.refetch()
  }
  async function submit() {
    if (
      busy.current ||
      !canConfirm ||
      qtyError ||
      (problem && (!note.trim() || !picked.length))
    )
      return
    busy.current = true
    setSaving(true)
    setError(undefined)
    const data: Report | undefined = problem
      ? { shipment_id: id, issues: picked, received_qty: Number(received), note: note.trim() }
      : undefined
    try {
      // Save the draft before the payment so a failed report upload can be retried after a refresh.
      if (data) {
        localStorage.setItem(storageKey, JSON.stringify(data))
        setReport(data)
      }
      await transaction.run("confirm", { id, accepted: !problem, quantity: Number(received) })
      setConfirmed(true)
      if (data) await saveReport(data)
      else {
        localStorage.removeItem(storageKey)
        setReport(undefined)
        setComplete(true)
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  async function retryReport() {
    if (
      !report ||
      report.shipment_id !== id ||
      busy.current ||
      !mine ||
      shipment?.status !== Status.DISPUTED
    )
      return
    busy.current = true
    setSaving(true)
    setError(undefined)
    try {
      await saveReport(report)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  const needsReport = mine && report?.shipment_id === id && shipment?.status === Status.DISPUTED
  const trip = shipment?.trip
  const carrier = trip?.carrier_name ?? "The driver"
  const payer = trip?.payer_name ?? "The company"
  const hub = hubName(query.data, address)
  const back = (
    <Link href="/warehouse" className={backClass}>
      <ArrowLeft className="size-4" aria-hidden />
      Arrivals
    </Link>
  )
  const backToArrivals = (
    <ButtonLink href="/warehouse" className="w-full">
      Back to arrivals
    </ButtonLink>
  )
  const feedback = (
    <>
      {error && (
        <p role="alert" className="text-danger [overflow-wrap:anywhere]">
          {error}
        </p>
      )}
      <TransactionStatus {...transaction} hash={complete ? undefined : transaction.hash} />
    </>
  )
  const shipmentCard = shipment && (
    <Card className="p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] leading-7 font-medium">Shipment #{id}</h2>
        {!canConfirm && <StatusChip status={shipment.status} />}
      </div>
      <dl className="mt-2">
        <KeyValue
          label="From"
          value={[trip?.payer_name, trip?.pickup?.name].filter(Boolean).join(", ")}
        />
        <KeyValue label="Driver" value={trip?.carrier_name ?? undefined} />
        <KeyValue
          label="Cargo"
          value={cargoText(trip) ?? (trip ? undefined : "Cargo details are not available.")}
        />
        <KeyValue
          label="Picked up"
          value={
            trip?.picked_up_at && Number.isFinite(Date.parse(trip.picked_up_at))
              ? dayTime(Date.parse(trip.picked_up_at))
              : undefined
          }
        />
      </dl>
      {shipment.metadataError && (
        <p role="alert" className="mt-3 text-danger">
          Shipment details could not be loaded. Check the goods and quantities with the driver.
        </p>
      )}
    </Card>
  )

  function content() {
    if (!shipment)
      return (
        <WarehouseResult
          icon={PackageX}
          title="Shipment not found"
          actions={
            <ButtonLink href="/warehouse/scan" icon={ScanLine} className="w-full">
              Scan another QR
            </ButtonLink>
          }
        >
          Check the driver&apos;s QR or backup code and try again.
        </WarehouseResult>
      )
    if (!mine)
      return (
        <WarehouseResult
          icon={CircleX}
          tone="danger"
          title="Not for this warehouse"
          actions={
            <>
              <ButtonLink href="/warehouse/scan" icon={ScanLine} className="w-full">
                Scan another QR
              </ButtonLink>
              <ButtonLink href="/warehouse" variant="quiet" icon={null} className="w-full">
                Back to arrivals
              </ButtonLink>
            </>
          }
        >
          Shipment #{id} goes to {trip?.destination?.name ?? "another warehouse"}
          {hub ? `, not ${hub}` : ""}. Ask the driver to check the address.
        </WarehouseResult>
      )
    if (complete && (problem || shipment.status === Status.DISPUTED))
      return (
        <WarehouseResult icon={Send} title="Report sent" actions={backToArrivals}>
          {payer} and {carrier} can see your report.
          {received ? ` The ${received} boxes you received are recorded.` : ""}
        </WarehouseResult>
      )
    if (complete)
      return (
        <WarehouseResult
          art={<WarehouseIllustration />}
          title="Delivery confirmed"
          actions={
            <>
              <div className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left ring-1 ring-line">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                  <BadgeCheck className="size-[18px]" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-label font-semibold [overflow-wrap:anywhere]">
                    Arrival confirmed{profile.data?.name ? ` by ${profile.data.name}` : ""}
                  </span>
                  <span className="text-caption text-muted-ink">
                    {completedAt ? dayTime(completedAt).replace("Today, ", "Today · ") : ""}
                    {transaction.hash && (
                      <>
                        {completedAt ? " · " : ""}
                        <a
                          href={receiptUrl(transaction.hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-4 hover:underline"
                        >
                          View receipt
                        </a>
                      </>
                    )}
                  </span>
                </span>
                {transaction.hash && (
                  <ArrowUpRight className="size-4 shrink-0 text-muted-ink" aria-hidden />
                )}
              </div>
              <div className="mt-2 w-full">{backToArrivals}</div>
            </>
          }
        >
          {received ? `${received} boxes` : "The goods"} from {payer} are in. {carrier} is getting
          paid right now.
        </WarehouseResult>
      )
    if (canConfirm && problem)
      return (
        <Column
          back={
            <button
              type="button"
              className={backClass}
              disabled={saving}
              onClick={() => {
                setProblem(false)
                setQuantity("")
              }}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Confirm delivery
            </button>
          }
          title="Report a problem"
          description={[`Shipment #${id}`, trip?.carrier_name].filter(Boolean).join(" · ")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="grid gap-4"
          >
            <Card className="p-5 md:p-7">
              <fieldset disabled={saving} className="grid gap-6">
                <div className="grid gap-3">
                  <p id="issue-label" className="text-label font-medium">
                    What&apos;s wrong?
                  </p>
                  <div role="group" aria-labelledby="issue-label" className="flex flex-wrap gap-2">
                    {issues.map((item) => {
                      const on = picked.includes(item)
                      return (
                        <label
                          key={item}
                          className={cn(
                            "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-label font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-stamp-ring",
                            on ? "bg-ink text-white" : "bg-canvas text-ink hover:bg-subtle",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() =>
                              setPicked((list) =>
                                on ? list.filter((x) => x !== item) : [...list, item],
                              )
                            }
                          />
                          {on && <Check className="size-4" aria-hidden />}
                          {item}
                        </label>
                      )
                    })}
                  </div>
                  {!picked.length && (
                    <p className="text-caption text-danger">Pick at least one.</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <label htmlFor="received-qty" className="text-label font-medium">
                    {expected === undefined
                      ? "How many items arrived?"
                      : "How many boxes arrived?"}
                  </label>
                  <div
                    className={cn(
                      "flex min-h-14 items-center gap-2 rounded-2xl border bg-surface px-4",
                      quantity && qtyError
                        ? "border-danger"
                        : quantity && expected !== undefined && Number(quantity) < expected
                          ? "border-warning"
                          : "border-line-strong",
                    )}
                  >
                    <input
                      id="received-qty"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      aria-invalid={quantity && qtyError ? true : undefined}
                      aria-describedby="received-qty-hint"
                      className="min-w-0 flex-1 bg-transparent py-3 text-heading font-medium outline-none"
                    />
                    {expected !== undefined && (
                      <span className="shrink-0 text-label text-muted-ink">of {expected}</span>
                    )}
                  </div>
                  <p
                    id="received-qty-hint"
                    className={cn(
                      "text-caption",
                      quantity && qtyError ? "text-danger" : "text-warning",
                    )}
                  >
                    {quantity && qtyError
                      ? qtyError
                      : quantity && expected !== undefined && Number(quantity) < expected
                        ? `${expected - Number(quantity)} boxes short. This goes into your report.`
                        : ""}
                  </p>
                </div>
                <label className="grid gap-2">
                  <span className="text-label font-medium">What happened</span>
                  <textarea
                    className={`${inputClass} min-h-28`}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    required
                    placeholder="Describe what is missing, damaged, or incorrect."
                  />
                </label>
              </fieldset>
            </Card>
            <p className="flex items-start gap-2.5 rounded-2xl bg-stamp-soft p-4 text-label">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {carrier} won&apos;t be paid early until {payer} settles this with{" "}
                {/^Pak/.test(trip?.carrier_name ?? "") ? "him" : "them"}.
              </span>
            </p>
            <Button
              type="submit"
              icon={Send}
              className="h-14 w-full"
              loading={saving}
              disabled={!!qtyError || !note.trim() || !picked.length}
            >
              {saving ? "Sending your report" : "Send report"}
            </Button>
            <Button
              variant="quiet"
              icon={null}
              className="w-full"
              disabled={saving}
              onClick={() => {
                setProblem(false)
                setQuantity("")
              }}
            >
              Cancel
            </Button>
            {feedback}
          </form>
        </Column>
      )
    if (canConfirm)
      return (
        <Column
          back={back}
          title="Confirm delivery"
          description={trip?.carrier_name ? `From ${trip.carrier_name}'s phone` : `Shipment #${id}`}
        >
          {shipmentCard}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="grid gap-4"
          >
            <Card className="p-5 md:p-7">
              <fieldset disabled={saving} className="grid gap-3">
                <legend className="mb-3 text-[18px] leading-7 font-medium">Check the goods</legend>
                <p className="text-label font-medium">Did everything arrive?</p>
                {[
                  {
                    on: true,
                    title:
                      expected === undefined
                        ? "All goods arrived"
                        : `All ${expected} boxes arrived`,
                    sub: "Nothing missing",
                    pick: () => undefined,
                  },
                  {
                    on: false,
                    title: "Some are missing or damaged",
                    sub: "You'll report what's wrong",
                    pick: () => {
                      setProblem(true)
                      setQuantity("")
                    },
                  },
                ].map((option) => (
                  <label
                    key={option.title}
                    className={cn(
                      "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-stamp-ring",
                      option.on ? "border-ink bg-stamp-soft" : "border-transparent bg-canvas",
                    )}
                  >
                    <input
                      type="radio"
                      name="condition"
                      checked={option.on}
                      onChange={option.pick}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full",
                        option.on ? "bg-ink" : "border-2 border-line-strong bg-surface",
                      )}
                    >
                      {option.on && <span className="size-2 rounded-full bg-stamp" />}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span className="text-body font-medium">{option.title}</span>
                      <span className="text-caption text-muted-ink">{option.sub}</span>
                    </span>
                  </label>
                ))}
                {expected === undefined && (
                  <Field
                    label="Number of items received"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    error={qtyError}
                  />
                )}
              </fieldset>
            </Card>
            <Button
              type="submit"
              icon={Check}
              className="h-14 w-full"
              loading={saving}
              disabled={!!qtyError}
            >
              {saving ? "Saving your confirmation" : "Confirm full delivery"}
            </Button>
            {saving ? (
              <p className="text-center text-caption text-muted-ink">
                Takes a second. Keep this page open.
              </p>
            ) : (
              <button
                type="button"
                className="mx-auto min-h-11 px-3 text-label font-medium text-danger underline-offset-4 hover:underline"
                onClick={() => {
                  setProblem(true)
                  setQuantity("")
                }}
              >
                Report a problem
              </button>
            )}
            {feedback}
          </form>
        </Column>
      )
    return (
      <Column back={back} title={`Shipment #${id}`} description={trip?.destination?.name}>
        {shipmentCard}
        {needsReport ? (
          <Card className="p-5 md:p-7">
            <h2 className="text-[18px] leading-7 font-medium">
              Delivery marked as having a problem
            </h2>
            <p className="my-4 text-muted-ink">
              The driver&apos;s payout is held. Your report details still need to be saved. Retry
              below to send the report without confirming the delivery again.
            </p>
            <Button block loading={saving} onClick={() => void retryReport()}>
              Retry saving report
            </Button>
          </Card>
        ) : (
          <Card className="p-5 md:p-7">
            <h2 className="text-[18px] leading-7 font-medium">
              {shipment.status === Status.APPROVED
                ? "This trip has not left yet"
                : "This delivery has already been checked"}
            </h2>
            <p className="mt-2 text-muted-ink">
              {shipment.status === Status.APPROVED
                ? "The driver needs to confirm pickup before you can receive the goods."
                : "You cannot confirm the same delivery twice."}
            </p>
            {trip?.report && (
              <dl className="mt-4">
                <KeyValue label="Problem" value={issueLabels(trip.report.issues)} />
                <KeyValue label="Received" value={`${trip.report.received_qty} items`} />
                <KeyValue
                  label="Note"
                  value={<span className="whitespace-pre-wrap">{trip.report.note}</span>}
                />
              </dl>
            )}
          </Card>
        )}
        {feedback}
      </Column>
    )
  }

  return (
    <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
      {content()}
    </QueryState>
  )
}
