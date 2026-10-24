"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, CircleX, Keyboard, ScanLine, X } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { useShipments } from "@/lib/ledger"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { Button, ButtonLink } from "@/components/elements/Button"
import { Card, QueryState } from "@/components/elements/DataState"
import { Modal } from "@/components/elements/Modal"
import { PageHeading } from "@/components/elements/PageHeading"
import { scannedShipmentId } from "../data/validation"
import { hubName } from "../data/display"
import { WarehouseResult } from "./WarehouseResult"

const CODE_LENGTH = 6

/** Yellow corner brackets and a scan line around the middle of the camera view. */
function Viewfinder({ dim }: { dim?: boolean }) {
  const corner = "absolute size-9 border-stamp md:size-11"
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[62%] max-w-[300px] -translate-x-1/2 -translate-y-1/2",
        dim && "opacity-60",
      )}
    >
      <span className={cn(corner, "top-0 left-0 rounded-tl-lg border-t-4 border-l-4")} />
      <span className={cn(corner, "top-0 right-0 rounded-tr-lg border-t-4 border-r-4")} />
      <span className={cn(corner, "bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4")} />
      <span className={cn(corner, "right-0 bottom-0 rounded-br-lg border-r-4 border-b-4")} />
      <span className="absolute inset-x-[12%] top-1/2 h-0.5 rounded-full bg-stamp/70" />
    </div>
  )
}

export function ScanScreen() {
  const { address, getAccessToken } = useAuth()
  const query = useShipments()
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const [camera, setCamera] = useState(false)
  const [ask, setAsk] = useState(false)
  const [code, setCode] = useState("")
  const [codeFocus, setCodeFocus] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const navigating = useRef(false)
  const state = useRef({ shipments: query.data, address })
  state.current = { shipments: query.data, address }
  function openShipment(id: string) {
    const shipment = state.current.shipments?.find((s) => s.id === id)
    if (!shipment) throw new Error("Shipment not found. Check the code with the driver.")
    if (shipment.consignee.toLowerCase() !== state.current.address?.toLowerCase())
      throw new Error("Not for this warehouse. Ask the driver to check the destination.")
    if (navigating.current) return
    navigating.current = true
    setCamera(false)
    router.push(`/confirm/${id}`)
  }
  const openRef = useRef(openShipment)
  openRef.current = openShipment
  useEffect(() => {
    if (!camera || !video.current) return
    let disposed = false
    let stop: (() => void) | undefined
    import("@zxing/browser")
      .then(async ({ BrowserQRCodeReader }) => {
        if (disposed || !video.current) return
        const controls = await new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video.current,
          (result) => {
            if (!result || disposed) return
            try {
              openRef.current(scannedShipmentId(result.getText(), window.location.origin))
            } catch (cause) {
              setError(errorMessage(cause))
            }
          },
        )
        stop = () => controls.stop()
        if (disposed) stop()
      })
      .catch(() => {
        if (!disposed) {
          setCamera(false)
          setError("Camera unavailable. Allow camera access or enter the six-character code below.")
        }
      })
    return () => {
      disposed = true
      stop?.()
    }
  }, [camera])
  async function lookup() {
    if (!/^[A-Z0-9]{6}$/.test(code) || pending) return
    setPending(true)
    setError(undefined)
    try {
      const data = await api<{ shipmentId: string; forYou: boolean }>(
        `/api/code/${encodeURIComponent(code)}`,
        { token: await getAccessToken(), walletAddress: address },
      )
      if (!data.forYou) throw new Error("Not for this warehouse.")
      const id = String(data.shipmentId)
      if (!/^(0|[1-9]\d*)$/.test(id))
        throw new Error("This code could not be read. Check it with the driver.")
      openShipment(id)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }
  function typeCode() {
    setAsk(false)
    setCamera(false)
    // Wait for the camera overlay to close before moving focus to the code boxes
    setTimeout(() => codeInput.current?.focus(), 0)
  }
  const hub = hubName(query.data, address)
  const wrongWarehouse = error?.startsWith("Not for this warehouse")
  const codeValid = /^[A-Z0-9]{6}$/.test(code)
  // The result screen replaces the camera view, so stop the camera with it
  useEffect(() => {
    if (wrongWarehouse) setCamera(false)
  }, [wrongWarehouse])

  if (wrongWarehouse)
    return (
      <WarehouseResult
        icon={CircleX}
        tone="danger"
        title="Not for this warehouse"
        actions={
          <>
            <Button
              icon={ScanLine}
              className="w-full"
              onClick={() => {
                setError(undefined)
                setCode("")
                navigating.current = false
              }}
            >
              Scan another QR
            </Button>
            <ButtonLink href="/warehouse" variant="quiet" icon={null} className="w-full">
              Back to arrivals
            </ButtonLink>
          </>
        }
      >
        This shipment goes to another warehouse{hub ? `, not ${hub}` : ""}. Ask the driver to check
        the address.
      </WarehouseResult>
    )

  return (
    <div className="space-y-6">
      <PageHeading
        title="Scan a delivery"
        description="Use this device's camera, or type the code under the driver's QR"
      />
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
          <div
            className={cn(
              "relative isolate min-w-0 overflow-hidden bg-[#1a1a1a] text-white",
              camera
                ? "fixed inset-0 z-40 md:relative md:inset-auto md:z-auto md:aspect-[4/3] md:rounded-[28px]"
                : "aspect-[4/5] rounded-[28px] sm:aspect-[4/3]",
            )}
          >
            {camera && (
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 size-full object-cover"
                aria-label="Delivery QR camera"
              />
            )}
            <Viewfinder dim={!camera} />
            {camera ? (
              <>
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(12px,env(safe-area-inset-top))]">
                  <button
                    type="button"
                    onClick={() => setCamera(false)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-body hover:bg-white/10"
                  >
                    <X className="size-5" aria-hidden />
                    Close
                  </button>
                </div>
                <p className="absolute inset-x-4 bottom-[22%] mx-auto w-fit max-w-[calc(100%-32px)] rounded-full bg-black/55 px-4 py-2 text-center text-label font-medium md:bottom-6">
                  Point at the QR on the driver&apos;s phone
                </p>
                <button
                  type="button"
                  onClick={typeCode}
                  className="absolute bottom-[max(32px,env(safe-area-inset-bottom))] left-1/2 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-4 text-label font-medium whitespace-nowrap md:hidden"
                >
                  <Keyboard className="size-4" aria-hidden />
                  Enter the code instead
                </button>
              </>
            ) : (
              <div className="absolute inset-x-4 bottom-6 grid justify-items-center gap-3">
                <Button
                  variant="moment"
                  icon={Camera}
                  onClick={() => {
                    setError(undefined)
                    setAsk(true)
                  }}
                >
                  Start camera
                </Button>
              </div>
            )}
          </div>
          <Card className="p-5 md:p-7">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void lookup()
              }}
              className="grid gap-4"
            >
              <h2 className="text-[18px] leading-7 font-medium">
                <label htmlFor="delivery-code">No camera? Type the code</label>
              </h2>
              <div className="relative max-w-[360px]">
                <input
                  ref={codeInput}
                  id="delivery-code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={CODE_LENGTH}
                  value={code}
                  onFocus={() => setCodeFocus(true)}
                  onBlur={() => setCodeFocus(false)}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, CODE_LENGTH),
                    )
                  }
                  aria-describedby="delivery-code-hint"
                  aria-invalid={code.length === CODE_LENGTH && !codeValid ? true : undefined}
                  className="absolute inset-0 z-10 size-full cursor-text opacity-0"
                />
                <div aria-hidden className="grid grid-cols-6 gap-1.5 sm:gap-2">
                  {Array.from({ length: CODE_LENGTH }, (_, i) => {
                    const active =
                      codeFocus &&
                      (i === code.length || (code.length === CODE_LENGTH && i === CODE_LENGTH - 1))
                    return (
                      <span
                        key={i}
                        className={cn(
                          "grid h-14 min-w-0 place-items-center rounded-xl border bg-canvas text-heading font-medium transition-colors",
                          active ? "border-ink bg-surface" : "border-transparent",
                        )}
                      >
                        {code[i] ?? ""}
                      </span>
                    )
                  })}
                </div>
              </div>
              <p id="delivery-code-hint" className="text-caption text-muted-ink">
                6 characters, shown under the QR on the driver&apos;s phone.
              </p>
              <Button type="submit" block loading={pending} disabled={!codeValid}>
                {pending ? "Finding delivery" : "Find delivery"}
              </Button>
            </form>
          </Card>
        </div>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </QueryState>
      <Modal
        open={ask}
        onOpenChange={setAsk}
        title="Allow the camera"
        description="Your phone asks next. tiba only uses the camera to read the driver's QR."
      >
        <div className="grid gap-2">
          <Button
            className="w-full"
            onClick={() => {
              setAsk(false)
              setCamera(true)
            }}
          >
            Continue
          </Button>
          <Button variant="quiet" icon={null} className="w-full bg-canvas" onClick={typeCode}>
            Type the code instead
          </Button>
        </div>
      </Modal>
    </div>
  )
}
