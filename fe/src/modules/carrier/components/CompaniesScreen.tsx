"use client"

import { useSyncExternalStore } from "react"
import { Link2, Send } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/providers/AuthProvider"
import { useNetwork } from "@/lib/queries"
import { useShipments } from "@/lib/ledger"
import { Status } from "@/lib/contracts"
import { PageHeading } from "@/components/elements/PageHeading"
import { ButtonLink } from "@/components/elements/Button"
import { QueryState } from "@/components/elements/DataState"
import { Initials } from "@/components/elements/PersonaAvatar"
import { profileLink } from "@/modules/profile/data/public-profile"

const noop = () => () => {}

export function CompaniesScreen() {
  const { address } = useAuth()
  const query = useNetwork()
  const shipments = useShipments()
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  )
  const me = address?.toLowerCase()
  const companies = query.data?.filter((r) => r.carrier_address.toLowerCase() === me) ?? []
  const mine = (shipments.data ?? []).filter((s) => s.carrier.toLowerCase() === me)
  const profileUrl = origin && address ? profileLink(origin, address) : ""
  async function copy() {
    try {
      await navigator.clipboard.writeText(profileUrl)
      toast.success("Profile link copied")
    } catch {
      toast.error("Could not copy. Please copy the link below.")
    }
  }
  return (
    <div className="space-y-6">
      <PageHeading title="Companies" description="Shipping companies that can send you trips" />
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        <div className="space-y-4">
          <section className="rounded-[28px] bg-surface px-5 pt-[18px] pb-2.5">
            <h2 className="text-[18px] leading-6 font-medium">Connected</h2>
            {companies.length ? (
              <ul className="mt-1">
                {companies.map((r) => {
                  const name = r.company_name ?? "Delivery company"
                  const theirs = mine.filter(
                    (s) => s.payer.toLowerCase() === r.payer_address.toLowerCase(),
                  )
                  const now = theirs.filter(
                    (s) => s.status === Status.APPROVED || s.status === Status.IN_TRANSIT,
                  ).length
                  const connected = r.status === "active" || r.status === "accepted"
                  return (
                    <li
                      key={r.payer_address}
                      className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0"
                    >
                      <Initials name={name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{name}</p>
                        <p className="text-caption text-muted-ink">
                          {connected ? "Connected" : r.status}
                          {shipments.data
                            ? ` · ${theirs.length} ${theirs.length === 1 ? "trip" : "trips"} with you`
                            : ""}
                        </p>
                      </div>
                      {shipments.data && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-canvas px-[11px] py-1.5 text-caption font-medium">
                          <span
                            aria-hidden
                            className={`size-[7px] rounded-full ${now ? "bg-info" : "bg-line-strong"}`}
                          />
                          {now ? `${now} ${now === 1 ? "trip" : "trips"} now` : "No trips now"}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="py-4 text-label text-muted-ink">
                No companies yet. Open the invitation link a company sends you to connect.
              </p>
            )}
          </section>
          <section className="@container space-y-3 rounded-[28px] bg-surface p-6">
            <h2 className="text-[18px] leading-6 font-medium">Work with a new company</h2>
            <p className="text-[13.5px] leading-5 text-muted-ink">
              Send them your link. When they connect, their trips show up here.
            </p>
            {profileUrl && (
              <>
                <div className="flex min-w-0 items-center gap-2.5 rounded-md bg-canvas px-4 py-3.5">
                  <Link2 size={16} className="shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {profileUrl.replace(/^https?:\/\//, "")}
                  </span>
                  <button
                    type="button"
                    onClick={copy}
                    className="-my-2 min-h-11 shrink-0 px-1 text-label font-semibold text-stamp-deep"
                  >
                    Copy
                  </button>
                </div>
                <ButtonLink
                  href={`https://wa.me/?text=${encodeURIComponent(`Add me as your carrier on tiba: ${profileUrl}`)}`}
                  target="_blank"
                  icon={Send}
                  block
                >
                  Share on WhatsApp
                </ButtonLink>
              </>
            )}
          </section>
        </div>
      </QueryState>
    </div>
  )
}
