"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { QRCodeSVG } from "qrcode.react"
import { useQueryClient } from "@tanstack/react-query"
import { Link2, Plus, Send, Truck, Warehouse, type LucideIcon } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { usePlaces, useNetwork } from "@/lib/queries"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/validation"
import type { Place } from "@/lib/types"
import { QueryState } from "@/components/elements/DataState"
import { Field, inputClass } from "@/components/elements/Form"
import { Button, ButtonLink } from "@/components/elements/Button"
import { Modal } from "@/components/elements/Modal"
import { RouteMap } from "@/components/elements/RouteMap"
type SearchResult = { place_id: number; display_name: string; lat: string; lon: string }
type InviteResult = { url: string; invite: { token: string; expires_at: string } }
export function NetworkScreen() {
  const auth = useAuth(),
    queries = useQueryClient()
  const relations = useNetwork(),
    places = usePlaces()
  const [modal, setModal] = useState<"carrier" | "place" | "warehouse" | null>(null)
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [address, setAddress] = useState(""),
    [kind, setKind] = useState<"pickup" | "destination">("destination"),
    [placeId, setPlaceId] = useState("")
  const [pin, setPin] = useState<{ lat: number; lng: number }>(),
    [results, setResults] = useState<SearchResult[]>([]),
    [searchError, setSearchError] = useState<string>(),
    [searching, setSearching] = useState(false),
    [searchText, setSearchText] = useState("")
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string>(),
    [invite, setInvite] = useState<{ url: string; expires?: string }>(),
    [copied, setCopied] = useState(false)
  const busy = useRef(false)
  useEffect(() => {
    if (modal !== "place" || searchText.trim().length < 5) {
      setResults([])
      return
    }
    const controller = new AbortController()
    setResults([])
    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError(undefined)
      try {
        const data = await api<SearchResult[]>(
          `/api/places/search?q=${encodeURIComponent(searchText.trim())}`,
          {
            signal: controller.signal,
            token: await auth.getAccessToken(),
            walletAddress: auth.address,
          },
        )
        setResults(data)
      } catch (cause) {
        if (!controller.signal.aborted)
          setSearchError(`${errorMessage(cause)} Enter the address and choose a pin on the map.`)
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 1100)
    return () => {
      clearTimeout(timer)
      controller.abort()
      setSearching(false)
    }
  }, [searchText, modal, auth])
  function show(value: "carrier" | "place" | "warehouse", place?: Place) {
    setModal(value)
    setName(place?.name ?? "")
    setPlaceId(place?.id ?? "")
    setEmail("")
    setAddress("")
    setSearchText("")
    setPin(undefined)
    setError(undefined)
    setInvite(undefined)
    setCopied(false)
  }
  async function createInvite(inviteKind: "carrier" | "warehouse", id?: string) {
    const data = await api<InviteResult>("/api/invites", {
      method: "POST",
      token: await auth.getAccessToken(),
      walletAddress: auth.address,
      body: {
        kind: inviteKind,
        label: name.trim(),
        ...(id ? { placeId: id } : {}),
        ...(inviteKind === "warehouse" && email.trim() ? { receiverEmail: email.trim() } : {}),
      },
    })
    const url = data.url
      ? new URL(data.url, window.location.origin)
      : data.invite.token
        ? new URL(`/join/${encodeURIComponent(data.invite.token)}`, window.location.origin)
        : undefined
    if (!url || !["http:", "https:"].includes(url.protocol))
      throw new Error(
        "The invitation was created, but no valid link was returned. Contact the team.",
      )
    setInvite({ url: url.toString(), expires: data.invite.expires_at })
  }
  async function submit() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(undefined)
    try {
      if (!name.trim()) throw new Error("Enter a name.")
      if (modal === "place") {
        if (
          !address.trim() ||
          !pin ||
          !Number.isFinite(pin.lat) ||
          !Number.isFinite(pin.lng) ||
          Math.abs(pin.lat) > 90 ||
          Math.abs(pin.lng) > 180
        )
          throw new Error("Enter the address and choose a valid map pin.")
        const { place: saved } = await api<{ place: Place }>("/api/places", {
          method: "POST",
          token: await auth.getAccessToken(),
          walletAddress: auth.address,
          body: {
            name: name.trim(),
            address: address.trim(),
            lat: pin.lat,
            lng: pin.lng,
            kind,
            ...(email.trim() && kind === "destination" ? { receiverEmail: email.trim() } : {}),
          },
        })
        await queries.invalidateQueries({ queryKey: ["api", "/api/places"] })
        if (kind === "destination") {
          setPlaceId(saved.id)
          setModal("warehouse")
          if (!saved.id)
            throw new Error(
              "Place saved, but its reference was not returned. Reload the list before inviting a receiver.",
            )
          await createInvite("warehouse", saved.id)
        } else setModal(null)
      } else
        await createInvite(
          modal === "warehouse" ? "warehouse" : "carrier",
          modal === "warehouse" ? placeId : undefined,
        )
      await queries.invalidateQueries({ queryKey: ["api", "/api/network"] })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  const validEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const carriers = relations.data ?? []
  const placeList = places.data ?? []
  const expiresInDays = invite?.expires
    ? Math.max(1, Math.round((new Date(invite.expires).getTime() - Date.now()) / 86_400_000))
    : undefined
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline font-medium">Your network</h1>
        <p className="mt-1.5 text-muted-ink">Carriers you hire and warehouses you deliver to</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <NetworkCard
          title="Carriers"
          count={relations.isLoading || relations.error ? undefined : carriers.length}
          action={
            <Button variant="secondary" icon={Plus} onClick={() => show("carrier")}>
              Invite
            </Button>
          }
        >
          <QueryState
            loading={relations.isLoading}
            error={relations.error}
            retry={() => relations.refetch()}
          >
            {carriers.length ? (
              <ul className="divide-y divide-line">
                {carriers.map((r) => {
                  const connected = ["joined", "connected", "active"].includes(r.status)
                  return (
                    <li key={r.carrier_address} className="flex items-center gap-3.5 px-1 py-3.5">
                      <Initials name={r.name ?? "Carrier"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.name ?? "Carrier"}</p>
                        <p className="truncate text-label text-muted-ink">
                          {r.plate ?? (connected ? "Vehicle details pending" : "Invite sent")}
                        </p>
                      </div>
                      <Chip
                        label={connected ? "Connected" : "Waiting"}
                        dot={connected ? "bg-success" : "bg-warning"}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <NetworkEmpty
                icon={Truck}
                title="No carriers yet"
                description="Invite the truck owners you already work with. They join with one link."
              />
            )}
          </QueryState>
        </NetworkCard>
        <NetworkCard
          title="Destinations"
          count={places.isLoading || places.error ? undefined : placeList.length}
          action={
            <Button variant="secondary" icon={Plus} onClick={() => show("place")}>
              Add
            </Button>
          }
        >
          <QueryState
            loading={places.isLoading}
            error={places.error}
            retry={() => places.refetch()}
          >
            {placeList.length ? (
              <ul className="divide-y divide-line">
                {placeList.map((p) => {
                  const waiting = p.kind === "destination" && !p.receiver_address
                  return (
                    <li key={p.id} className="flex items-center gap-3.5 px-1 py-3.5">
                      <Initials name={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="line-clamp-2 text-label text-muted-ink">
                          {[
                            p.address,
                            p.kind === "pickup"
                              ? "Pickup point"
                              : waiting
                                ? "Receiver not linked yet"
                                : "Receiver linked",
                          ].join(" · ")}
                        </p>
                        {waiting && (
                          <button
                            type="button"
                            className="mt-1 min-h-9 text-label font-medium text-stamp-deep underline-offset-4 hover:underline"
                            onClick={() => show("warehouse", p)}
                          >
                            Invite receiver
                          </button>
                        )}
                      </div>
                      <Chip
                        label={p.kind === "pickup" ? "Pickup" : waiting ? "Waiting" : "Linked"}
                        dot={
                          p.kind === "pickup" ? "bg-muted-ink" : waiting ? "bg-warning" : "bg-info"
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <NetworkEmpty
                icon={Warehouse}
                title="No destinations yet"
                description="Add the warehouses your goods go to. Their staff confirm arrivals."
              />
            )}
          </QueryState>
        </NetworkCard>
      </div>
      <Modal
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !pending) setModal(null)
        }}
        title={
          modal === "carrier"
            ? "Invite a carrier"
            : modal === "warehouse"
              ? "Invite the receiver"
              : "Add a destination"
        }
        description={
          modal === "carrier"
            ? "Send this link to the truck owner. When they open it and sign up, they show up in your list."
            : modal === "warehouse"
              ? "Send this link to the warehouse staff. They confirm arrivals for this place."
              : undefined
        }
      >
        {invite ? (
          <div className="space-y-4">
            <div className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-canvas px-4 py-3.5">
              <Link2 size={16} className="shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate" title={invite.url}>
                {invite.url.replace(/^https?:\/\//, "")}
              </span>
              <button
                type="button"
                className="min-h-9 shrink-0 text-label font-semibold text-stamp-deep underline-offset-4 hover:underline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invite.url)
                    setCopied(true)
                  } catch {
                    setError("Could not copy the link. Select and copy it above.")
                  }
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <ButtonLink
              block
              icon={Send}
              target="_blank"
              href={`https://wa.me/?text=${encodeURIComponent(`Join our TIBA network: ${invite.url}`)}`}
            >
              Share on WhatsApp
            </ButtonLink>
            <div className="flex items-center gap-3.5 rounded-[18px] bg-canvas p-3.5">
              <div className="shrink-0 rounded-xl bg-white p-2">
                <QRCodeSVG value={invite.url} size={64} title="Invitation QR code" />
              </div>
              <p className="min-w-0 text-label text-ink-2">
                Meeting in person? They can scan this instead.
                {expiresInDays
                  ? ` The link expires in ${expiresInDays} ${expiresInDays === 1 ? "day" : "days"}.`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Field
              label={
                modal === "carrier"
                  ? "Name (only you see this)"
                  : modal === "warehouse"
                    ? "Destination"
                    : "Name"
              }
              hint={modal === "place" ? "What your team calls it" : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              disabled={modal === "warehouse"}
            />
            {modal === "place" && (
              <>
                <label className="block space-y-2">
                  <span className="text-label font-medium">Place type</span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as "pickup" | "destination")}
                    className={inputClass}
                  >
                    <option value="destination">Destination</option>
                    <option value="pickup">Pickup</option>
                  </select>
                </label>
                <Field
                  label="Address"
                  value={address}
                  minLength={5}
                  maxLength={500}
                  onChange={(e) => {
                    setAddress(e.target.value)
                    setSearchText(e.target.value)
                    setPin(undefined)
                  }}
                  required
                  hint="Type at least 5 letters to search, then check the pin on the map."
                />
                {searching && <p role="status">Searching addresses…</p>}
                {searchError && (
                  <p role="status" className="text-danger">
                    {searchError}
                  </p>
                )}
                {results.length > 0 && (
                  <ul
                    aria-label="Address suggestions"
                    className="rounded-2xl border border-line p-2"
                  >
                    {results.map((r) => (
                      <li key={r.place_id}>
                        <button
                          type="button"
                          className="min-h-11 w-full rounded-xl p-3 text-left hover:bg-canvas"
                          onClick={() => {
                            setAddress(r.display_name)
                            setSearchText("")
                            setResults([])
                            setPin({ lat: Number(r.lat), lng: Number(r.lon) })
                          }}
                        >
                          {r.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="overflow-hidden rounded-[18px]">
                  <RouteMap
                    destination={pin ? { ...pin, name: name || "New place" } : undefined}
                    onPinChange={(lat, lng) => setPin({ lat, lng })}
                  />
                </div>
                <p className="text-caption text-muted-ink">
                  {pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)
                    ? `Pin selected: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
                    : kind === "destination"
                      ? "Tap the map at the gate where trucks unload."
                      : "Tap the map where trucks load."}
                </p>
                <details className="rounded-2xl border border-line p-4">
                  <summary className="min-h-11 cursor-pointer font-medium">
                    Enter map coordinates instead
                  </summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Latitude"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={-90}
                      max={90}
                      required
                      value={pin && Number.isFinite(pin.lat) ? pin.lat : ""}
                      onChange={(event) =>
                        setPin((previous) => ({
                          lat: event.target.valueAsNumber,
                          lng: previous?.lng ?? NaN,
                        }))
                      }
                    />
                    <Field
                      label="Longitude"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={-180}
                      max={180}
                      required
                      value={pin && Number.isFinite(pin.lng) ? pin.lng : ""}
                      onChange={(event) =>
                        setPin((previous) => ({
                          lat: previous?.lat ?? NaN,
                          lng: event.target.valueAsNumber,
                        }))
                      }
                    />
                  </div>
                </details>
              </>
            )}
            {(modal === "warehouse" || (modal === "place" && kind === "destination")) && (
              <Field
                label="Receiver's work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                error={!validEmail ? "Enter a valid email address." : undefined}
                hint="We'll make an invite link for this receiver."
              />
            )}
            <Button
              type="submit"
              block
              loading={pending}
              icon={modal === "place" ? Plus : Link2}
              disabled={
                pending ||
                !name.trim() ||
                !validEmail ||
                ((modal === "warehouse" || (modal === "place" && kind === "destination")) &&
                  !email.trim()) ||
                (modal === "place" && (!pin || !address.trim()))
              }
            >
              {pending
                ? "Saving"
                : modal === "place"
                  ? kind === "destination"
                    ? "Add destination"
                    : "Add pickup"
                  : "Create invite link"}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </Modal>
    </div>
  )
}

function NetworkCard({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: number
  action: ReactNode
  children: ReactNode
}) {
  return (
    <section className="@container min-w-0 rounded-[28px] bg-surface px-[22px] pt-[22px] pb-3.5">
      <div className="flex items-center justify-between gap-3 pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-heading font-medium">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-canvas px-2.5 py-0.5 text-caption font-medium">
              {count}
            </span>
          )}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {children}
    </section>
  )
}

function NetworkEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="grid justify-items-center gap-2.5 px-4 pt-5 pb-6 text-center">
      <span className="grid h-[102px] w-[136px] place-items-center rounded-[14px] bg-canvas">
        <Icon size={36} className="text-muted-ink" aria-hidden />
      </span>
      <h3 className="font-medium">{title}</h3>
      <p className="max-w-[280px] text-label text-muted-ink">{description}</p>
    </div>
  )
}

function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-full bg-subtle text-label font-semibold"
    >
      {letters || "?"}
    </span>
  )
}

function Chip({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-caption font-medium whitespace-nowrap">
      <span className={`size-[7px] rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  )
}
