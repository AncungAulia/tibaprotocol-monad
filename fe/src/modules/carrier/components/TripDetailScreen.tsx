"use client"

import { useState } from "react"
import { CircleAlert, MapPin, Navigation, PackageCheck, QrCode } from "lucide-react"
import { Amount } from "@/components/elements/Amount"
import { Modal } from "@/components/elements/Modal"
import { ReadyToGetPaid, TripFacts, TripPaid, TripQR, tripTitle } from "./TripPresentation"
import { useAuth } from "@/providers/AuthProvider"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/validation"
import { useShipments, useTransaction } from "@/lib/ledger"
import { Status } from "@/lib/contracts"
import { formatUsdcWithUnit } from "@/lib/format"
import { Card, EmptyState, QueryState, TextLink } from "@/components/elements/DataState"
import { Button, ButtonLink } from "@/components/elements/Button"
import { CheckField } from "@/components/elements/Form"
import { RouteMap } from "@/components/elements/RouteMap"
import { TransactionStatus } from "@/components/elements/TransactionStatus"
import { StatusChip } from "@/components/elements/StatusChip"
import { useTripLocation } from "../hooks/useTripLocation"
import { useNow } from "../hooks/useNow"
import { formatKm, tripEstimate } from "../data/estimate"
import { payoutAmount } from "../data/payouts"
import { issueLabels } from "../../warehouse/data/report"

export function TripDetailScreen({ id }: { id: string }) {
  const { address, getAccessToken } = useAuth()
  const query = useShipments()
  const transaction = useTransaction()
  const now = useNow()
  const [sheet, setSheet] = useState<"pickup" | "location" | null>(null)
  const [qr, setQr] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [shareChoice, setShareChoice] = useState<boolean>()
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState<string>()
  const [showReport, setShowReport] = useState(false)
  const [paid, setPaid] = useState(false)
  const shipment = query.data?.find(
    (s) => s.id === id && s.carrier.toLowerCase() === address?.toLowerCase(),
  )
  const share = shareChoice ?? shipment?.trip?.share_location ?? true
  const locationError = useTripLocation(id, share && shipment?.status === Status.IN_TRANSIT)
  async function changeShare(next: boolean) {
    if (shareSaving) return
    const previous = share
    setShareChoice(next)
    setShareSaving(true)
    setShareError(undefined)
    try {
      await api(`/api/trips/${id}`, {
        method: "PATCH",
        token: await getAccessToken(),
        walletAddress: address,
        body: { shareLocation: next },
      })
      void query.refetch()
    } catch (cause) {
      setShareChoice(previous)
      setShareError(`We could not save your location choice. ${errorMessage(cause)}`)
    } finally {
      setShareSaving(false)
    }
  }
  async function pickup() {
    if (!loaded || shipment?.status !== Status.APPROVED) return
    try {
      await transaction.run("pickup", { id })
    } catch {
      /* TransactionStatus displays the error. */
    }
  }
  async function getPaid() {
    if (shipment?.status !== Status.DELIVERED || paid) return
    try {
      await transaction.run("advance", { id })
      setPaid(true)
    } catch {
      /* TransactionStatus displays the error. */
    }
  }
  const trip = shipment?.trip
  const alreadyPaid =
    paid || shipment?.status === Status.FINANCED || shipment?.status === Status.REPAID
  const received = shipment && payoutAmount(shipment)
  const paidDirectly = shipment?.status === Status.REPAID && shipment.advanced === 0n
  const estimate = tripEstimate(trip, now)
  const company = trip?.payer_name ?? "Your shipping company"
  const destination = trip?.destination?.name ?? "the warehouse"
  const mapLabel = shipment?.status === Status.APPROVED
    ? `Pickup at ${trip?.pickup?.name ?? "the warehouse"}`
    : shipment?.status === Status.IN_TRANSIT
      ? share && !locationError ? "Sharing location" : "Location sharing paused"
      : `At ${destination}`
  const shareField = (
    <div className="rounded-2xl bg-canvas px-4 py-3">
      <CheckField checked={share} disabled={shareSaving} onChange={(e) => void changeShare(e.target.checked)}>
        Share my location during this trip
      </CheckField>
      <p className="text-caption text-muted-ink">{company} can follow this trip while this page is open. Sharing stops when you arrive, turn it off, or leave this page.</p>
      {shareError && <p role="alert" className="mt-2 text-label text-danger">{shareError}</p>}
    </div>
  )
  return (
    <div className="space-y-4">
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {!shipment ? (
          <Card><EmptyState title="Trip not found" description="This shipment is not assigned to your driver account." /></Card>
        ) : alreadyPaid ? (
          <TripPaid amount={received ?? (shipment.amount * 98n) / 100n} hash={paid ? transaction.hash : undefined} direct={paidDirectly} />
        ) : (
          <>
            <TextLink href="/carrier" className="text-muted-ink">← Trips</TextLink>
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-headline font-medium [overflow-wrap:anywhere]">{tripTitle(shipment)}</h1>
                <p className="mt-1 text-label text-muted-ink">#{id} · {company}</p>
              </div>
              <StatusChip status={shipment.status} className="bg-transparent px-0 text-caption ring-0" />
            </header>
            {shipment.metadataError && <p role="alert" className="text-danger">Trip details are unavailable. Refresh to try again.</p>}
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <RouteMap
                pickup={trip?.pickup} destination={trip?.destination} route={trip?.route_geojson}
                location={trip?.location} simulation={trip?.simulation} channel={trip?.channel}
                className="h-[290px] lg:h-[520px]"
                label={<span className="flex items-center gap-2"><span aria-hidden className={`size-1.5 rounded-full ${shipment.status === Status.IN_TRANSIT && share && !locationError ? "bg-success" : "bg-muted-ink"}`} />{mapLabel}</span>}
              />
              <div className="min-w-0 space-y-4">
                {shipment.status === Status.APPROVED && (
                  <Card className="space-y-3 p-6 md:p-6">
                    <h2 className="text-label text-muted-ink">You get on arrival</h2>
                    <Amount size="hero" value={(shipment.amount * 98n) / 100n} />
                    <p className="text-label leading-relaxed text-muted-ink">98% of {formatUsdcWithUnit(shipment.amount)}, paid the moment {destination} confirms.</p>
                    <Button icon={PackageCheck} className="w-full" disabled={transaction.pending} onClick={() => setSheet("pickup")}>Confirm pickup</Button>
                  </Card>
                )}
                {shipment.status === Status.IN_TRANSIT && (
                  <Card className="space-y-3 p-6 md:p-6">
                    {(estimate.arrivesAt !== undefined || estimate.kmLeft !== undefined) && (
                      <div className="flex flex-wrap justify-between gap-4 pb-1">
                        {estimate.arrivesAt !== undefined && <div><p className="text-caption text-muted-ink">Arriving around</p><p className="text-amount font-medium">{new Date(estimate.arrivesAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p></div>}
                        {estimate.kmLeft !== undefined && <div className="ml-auto text-right"><p className="text-caption text-muted-ink">Left to go</p><p className="text-amount font-medium">{formatKm(estimate.kmLeft)}</p></div>}
                      </div>
                    )}
                    <Button icon={QrCode} className="w-full" onClick={() => setQr(true)}>Show QR at arrival</Button>
                    {trip?.destination && <ButtonLink variant="secondary" icon={Navigation} className="w-full" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${trip.destination.lat},${trip.destination.lng}`}>Open in Google Maps</ButtonLink>}
                    <Button variant="quiet" icon={null} className="w-full bg-canvas text-danger" onClick={() => setShowReport(true)}>Report a problem</Button>
                    <details className="text-label"><summary className="cursor-pointer py-2 text-muted-ink">Location sharing</summary>{shareField}<p className="mt-2 text-caption text-muted-ink">Updates are shared about every 30 seconds. Enabling sharing asks for browser location permission.</p></details>
                    {locationError && <p role="alert" className="text-label text-danger">{locationError}</p>}
                  </Card>
                )}
                {shipment.status === Status.DELIVERED && <ReadyToGetPaid shipment={shipment} pending={transaction.pending} onPay={() => void getPaid()} />}
                {shipment.status === Status.DISPUTED && (
                  <Card className="space-y-3 rounded-3xl bg-danger/10 px-5 py-[18px] md:px-5 md:py-[18px]">
                    <h2 className="flex items-start gap-2 text-body font-medium"><CircleAlert size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />{destination} reported a problem</h2>
                    <p className="text-label leading-relaxed">{trip?.report?.note && <span className="whitespace-pre-wrap break-words">&quot;{trip.report.note}&quot; </span>}Your payout is on hold until {company} settles it with you.</p>
                    <Button variant="secondary" className="w-full" onClick={() => setShowReport(true)}>Read the report</Button>
                    <p className="text-caption text-muted-ink">Your company has been told about this report.</p>
                  </Card>
                )}
                <TransactionStatus {...transaction} />
                <TripFacts shipment={shipment} />
              </div>
            </div>
            <Modal open={sheet === "pickup"} onOpenChange={(open) => { if (!open) setSheet(null) }} title="Confirm pickup" className="inset-x-2 bottom-2 rounded-[32px] p-5 md:w-[460px] md:p-7 [&>h2]:text-heading [&>div:last-child]:mt-4">
              <div className="rounded-2xl bg-canvas px-4 py-3"><CheckField checked={loaded} onChange={(e) => setLoaded(e.target.checked)}>{trip?.cargo ? `All ${trip.cargo} are loaded` : "The goods are loaded and ready for delivery."}</CheckField></div>
              {shareField}
              <Button className="w-full" icon={PackageCheck} disabled={!loaded || transaction.pending || shareSaving} loading={transaction.pending} onClick={() => { if (share) setSheet("location"); else { setSheet(null); void pickup() } }}>Confirm pickup</Button>
            </Modal>
            <Modal open={sheet === "location"} onOpenChange={(open) => { if (!open) setSheet(null) }} title="Allow location while driving" description={`Your phone will ask next. tiba only uses your location while a trip is on the road, and only ${company} can see it.`} leading={<span className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-stamp-soft text-stamp-deep"><MapPin size={30} aria-hidden /></span>} className="inset-x-2 bottom-2 rounded-[32px] p-5 text-center md:w-[460px] md:p-7 [&>h2]:pr-0 [&>h2]:text-heading">
              <Button className="w-full" onClick={() => { setSheet(null); void pickup() }}>Continue</Button>
              <Button variant="quiet" icon={null} className="w-full bg-canvas" onClick={() => { void changeShare(false); setSheet("pickup") }}>Not now</Button>
            </Modal>
            <TripQR shipment={shipment} open={qr} onOpenChange={setQr} />
            <Modal open={showReport} onOpenChange={setShowReport} title={shipment.status === Status.DISPUTED ? "Delivery report" : "Report a problem"}>
              {trip?.report ? <><p>{issueLabels(trip.report.issues)}</p><p>{trip.report.received_qty} items received</p><p className="whitespace-pre-wrap break-words">{trip.report.note}</p></> : <p className="text-muted-ink">Contact {company} {shipment.status === Status.DISPUTED ? "for the warehouse report." : "to report a problem with this trip."}</p>}
              <Button block variant="secondary" onClick={() => setShowReport(false)}>Close</Button>
            </Modal>
          </>
        )}
      </QueryState>
    </div>
  )
}
