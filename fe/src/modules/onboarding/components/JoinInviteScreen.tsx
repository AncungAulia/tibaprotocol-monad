"use client"

import { useState, type ReactNode } from "react"
import Image from "next/image"
import { ADVANCE_BPS, BPS } from "@tiba/sc"
import type { Address } from "viem"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BadgeCheck,
  Handshake,
  Link2Off,
  ScanLine,
  type LucideIcon,
} from "lucide-react"
import { Button, ButtonLink } from "@/components/elements/Button"
import { Initials } from "@/components/elements/PersonaAvatar"
import { useAuth } from "@/providers/AuthProvider"
import { useApiQuery, useProfile } from "@/lib/queries"
import type { Invite } from "@/lib/types"
import { errorMessage } from "@/lib/validation"
import { roleHome } from "@/types/role"
import { NetworkCheck, SaveError, useSetupSave } from "./SetupFrame"

function count(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

export function JoinInviteScreen({ id }: { id: string }) {
  const invite = useApiQuery<
    {
      token: string
      kind: "carrier" | "warehouse"
      label: string | null
      state: "valid" | "expired" | "used"
      expiresAt: string
      inviter: {
        address: Address
        companyName: string | null
        verified: boolean
        creditLimit: number | null
        repaidCount?: number
        lateCount?: number
      }
      place: { name: string } | null
    },
    Invite & { verified: boolean; state: "active" | "expired" | "used" }
  >(`/api/invites/${encodeURIComponent(id)}`, true, true, (data) => ({
    token: data.token,
    kind: data.kind,
    label: data.label ?? "Company invitation",
    payer_address: data.inviter.address,
    expires_at: data.expiresAt,
    company_name: data.inviter.companyName ?? undefined,
    verified: data.inviter.verified,
    credit_limit: data.inviter.creditLimit == null ? undefined : String(data.inviter.creditLimit),
    repaid_count: count(data.inviter.repaidCount),
    late_count: count(data.inviter.lateCount),
    place_name: data.place?.name,
    state: data.state === "valid" ? "active" : data.state,
  }))
  const profile = useProfile()
  const auth = useAuth()
  const router = useRouter()
  const { save, pending, error, wrongNetwork } = useSetupSave()
  const [accepted, setAccepted] = useState(false)
  const data = invite.data
  const state = data?.state
  const roleMatches = !profile.data || profile.data.role === data?.kind
  async function accept() {
    if (
      !data ||
      data.state !== "active" ||
      Date.parse(data.expires_at) <= Date.now() ||
      !roleMatches
    )
      return
    if (data.kind === "carrier" && !profile.data) {
      router.push(`/onboarding/carrier?invite=${encodeURIComponent(id)}`)
      return
    }
    const result = await save<Record<string, unknown>>(
      `/api/invites/${encodeURIComponent(id)}/accept`,
      {},
    )
    if (result) setAccepted(true)
  }
  const company = data?.company_name ?? data?.label ?? "The company"
  const place = data?.place_name ?? data?.label ?? "your destination"
  const leave = () => router.push(profile.data ? roleHome[profile.data.role] : "/start")
  return (
    <section className="w-full rounded-none bg-transparent p-1 md:rounded-[32px] md:bg-surface md:p-10">
      {invite.isLoading ? (
        <p role="status">Loading your invitation…</p>
      ) : invite.error ? (
        <div role="alert" className="space-y-4">
          <p className="text-danger">{errorMessage(invite.error)}</p>
          <Button variant="secondary" onClick={() => invite.refetch()}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <InviteMessage
          icon={Link2Off}
          title="We can't find this link"
          description="Ask the company for a new invitation link."
        >
          <ButtonLink href="/" variant="secondary" icon={ArrowRight} className="w-full">
            Go to tiba
          </ButtonLink>
        </InviteMessage>
      ) : accepted ? (
        data.kind === "warehouse" ? (
          <div className="space-y-6">
            <div className="grid h-[210px] w-full max-w-[280px] place-items-center overflow-hidden rounded-[20px] bg-canvas">
              <Image src="/illustrations/role-warehouse.svg" alt="" width={280} height={210} />
            </div>
            <Heading
              title="You're all set"
              description={`When a truck arrives at ${place}, scan the QR on the driver's phone to confirm.`}
            />
            <div className="space-y-3">
              <ButtonLink href="/warehouse/scan" icon={ScanLine} className="w-full">
                Open scanner
              </ButtonLink>
              <ButtonLink
                href={roleHome.warehouse}
                variant="quiet"
                icon={null}
                className="w-full bg-canvas"
              >
                I&apos;ll do it later
              </ButtonLink>
            </div>
          </div>
        ) : (
          <InviteMessage
            icon={Handshake}
            stamp
            title="You're connected"
            description={`${company} can now send you trips. You'll see them on your trips page.`}
          >
            <Button className="w-full" onClick={() => router.replace(roleHome[data.kind])}>
              Go to my trips
            </Button>
          </InviteMessage>
        )
      ) : state !== "active" ? (
        <InviteMessage
          icon={Link2Off}
          title={state === "used" ? "This link was already used" : "This link has expired"}
          description={`Ask ${company} to send you a new one. It only takes them a few seconds.`}
        >
          <ButtonLink href="/" variant="secondary" icon={ArrowRight} className="w-full">
            Go to tiba
          </ButtonLink>
        </InviteMessage>
      ) : (
        <div className="space-y-6">
          <Heading
            title={
              data.kind === "warehouse"
                ? `Receive goods for ${company}`
                : `${company} wants to work with you`
            }
            description={
              data.kind === "warehouse"
                ? "You'll confirm deliveries that arrive at this address."
                : "Accept to get trips from them. You get paid the moment a delivery is confirmed."
            }
          />
          <div className="space-y-3 rounded-[22px] bg-canvas p-5">
            <div className="flex min-w-0 items-center gap-3">
              <Initials name={company} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] leading-6 font-medium">{company}</p>
                <p className="text-caption text-muted-ink">
                  {data.kind === "warehouse" ? "Invited you as a receiver" : "Shipping company"}
                </p>
              </div>
              {data.verified === true && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-caption font-medium text-success">
                  <BadgeCheck size={13} aria-hidden />
                  Verified
                </span>
              )}
            </div>
            <dl>
              {data.kind === "warehouse" ? (
                <Row label="Destination" value={place} />
              ) : (
                <>
                  {data.credit_limit !== undefined && (
                    <Row
                      label="Credit limit"
                      value={`${Number(data.credit_limit).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })} USDC`}
                    />
                  )}
                  {data.repaid_count !== undefined && (
                    <Row
                      label="Bills repaid"
                      value={`${data.repaid_count} ${data.repaid_count === 1 ? "shipment" : "shipments"}`}
                    />
                  )}
                  {data.late_count !== undefined && (
                    <Row
                      label="Paid late"
                      value={`${data.late_count} ${data.late_count === 1 ? "time" : "times"}`}
                    />
                  )}
                  <Row label="You get" value={`${(ADVANCE_BPS / BPS) * 100}% on arrival`} />
                </>
              )}
            </dl>
          </div>
          {!auth.ready || (auth.authenticated && profile.isLoading) ? (
            <p role="status">Checking your account…</p>
          ) : !auth.authenticated ? (
            <div className="space-y-4">
              <Button className="w-full" onClick={auth.login}>
                Sign in to accept
              </Button>
              <p className="text-label text-muted-ink">
                {data.kind === "warehouse"
                  ? "Use your work email or a wallet. Nothing to install."
                  : "New to tiba? Setup takes about a minute."}
              </p>
            </div>
          ) : profile.error ? (
            <div className="space-y-3">
              <SaveError error={errorMessage(profile.error)} />
              <Button className="w-full" variant="secondary" onClick={() => profile.refetch()}>
                Check account again
              </Button>
            </div>
          ) : !roleMatches ? (
            <div className="space-y-3">
              <p role="alert" className="text-danger">
                This invitation is for a {data.kind}. You are signed in as a {profile.data?.role}.
                Sign in with another account to accept it.
              </p>
              <Button className="w-full" variant="secondary" onClick={() => auth.logout()}>
                Switch account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <NetworkCheck />
              <SaveError error={error} />
              <Button
                className="w-full"
                loading={pending}
                disabled={wrongNetwork || !auth.address}
                onClick={accept}
              >
                {pending ? "Accepting" : "Accept"}
              </Button>
              <Button variant="quiet" icon={null} className="w-full bg-canvas" onClick={leave}>
                Not now
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-2.5">
      <h1 className="text-headline font-medium break-words">{title}</h1>
      <p className="text-muted-ink">{description}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-[14px] leading-5 last:border-b-0">
      <dt className="text-muted-ink">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function InviteMessage({
  icon: Icon,
  stamp = false,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  stamp?: boolean
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="space-y-6">
      <span
        className={`grid size-20 place-items-center rounded-full ${stamp ? "bg-stamp" : "bg-canvas"}`}
      >
        <Icon size={34} strokeWidth={1.75} aria-hidden />
      </span>
      <Heading title={title} description={description} />
      {children}
    </div>
  )
}
