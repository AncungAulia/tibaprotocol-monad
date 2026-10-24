"use client"

import { isAddress } from "viem"
import { BadgeCheck } from "lucide-react"
import { Button } from "@/components/elements/Button"
import { Card } from "@/components/elements/DataState"
import { Logo } from "@/components/elements/Logo"
import { PersonaAvatar } from "@/components/elements/PersonaAvatar"
import { ApiError } from "@/lib/api"
import { useApiQuery } from "@/lib/queries"
import { errorMessage } from "@/lib/validation"
import { parsePublicProfile, roleLabel } from "../data/public-profile"

export function PublicProfileScreen({ address }: { address: string }) {
  const valid = isAddress(address)
  const profile = useApiQuery(
    `/api/profile/${encodeURIComponent(address)}`,
    valid,
    true,
    parsePublicProfile,
  )
  const data = profile.data
  const notFound =
    !valid ||
    (profile.error instanceof ApiError && profile.error.status === 404) ||
    (profile.isSuccess && !data)
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] px-4 py-6">
      <Logo />
      <main id="main-content" className="pt-10">
        <Card>
          {notFound ? (
            <div className="space-y-3">
              <h1 className="text-heading">We could not find this profile</h1>
              <p className="text-muted-ink">Check the link or ask for a new one.</p>
            </div>
          ) : profile.isLoading ? (
            <p role="status">Loading profile…</p>
          ) : profile.error || !data ? (
            <div role="alert" className="space-y-4">
              <p className="text-danger">{errorMessage(profile.error)}</p>
              <Button variant="secondary" onClick={() => profile.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <PersonaAvatar role={data.role} size={56} />
                <div>
                  <h1 className="text-headline font-medium">
                    {data.role === "payer" && data.company
                      ? data.company.name
                      : (data.name ?? roleLabel[data.role])}
                  </h1>
                  <p className="mt-1 text-muted-ink">{roleLabel[data.role]}</p>
                </div>
              </div>
              {data.role === "payer" && data.company ? (
                <>
                  {data.company.verified && (
                    <p className="flex items-center gap-2 text-success">
                      <BadgeCheck size={18} aria-hidden />
                      Verified company
                    </p>
                  )}
                  {(data.company.city || data.name) && (
                    <dl className="space-y-3 rounded-2xl bg-canvas p-4">
                      {data.company.city && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-ink">City</dt>
                          <dd>{data.company.city}</dd>
                        </div>
                      )}
                      {data.name && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-ink">Contact</dt>
                          <dd>{data.name}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </>
              ) : data.plate ? (
                <dl className="rounded-2xl bg-canvas p-4">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-ink">Truck plate</dt>
                    <dd className="font-medium">{data.plate}</dd>
                  </div>
                </dl>
              ) : null}
              {data.role === "carrier" && (
                <p className="text-caption text-muted-ink">
                  Companies on tiba can invite this truck owner to move their goods.
                </p>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
