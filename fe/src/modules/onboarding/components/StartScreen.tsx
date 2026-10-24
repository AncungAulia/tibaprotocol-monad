"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { Check, Wallet } from "lucide-react"
import { Button } from "@/components/elements/Button"
import { Card } from "@/components/elements/DataState"
import { useAuth } from "@/providers/AuthProvider"
import { useProfile } from "@/lib/queries"
import { monadTestnet } from "@/lib/chain"
import { errorMessage } from "@/lib/validation"
import { roleHome } from "@/types/role"
import { NetworkCheck } from "./SetupFrame"
import { OnboardingSteps } from "./OnboardingSteps"
import { Modal } from "@/components/elements/Modal"
import { usePayerSetupStatus } from "../hooks/usePayerSetupStatus"

const roles = [
  {
    id: "payer",
    title: "I ship goods",
    description:
      "Approve trips before the truck leaves and pay at the due date. Your carriers get paid on arrival.",
  },
  {
    id: "carrier",
    title: "I own a truck",
    description:
      "Confirm pickup, show a QR at the destination, and get paid the moment goods arrive.",
  },
  {
    id: "investor",
    title: "I fund deliveries",
    description: "Deposit USDC into the pool and earn when shipping companies pay their bills.",
  },
] as const

export function StartScreen() {
  const auth = useAuth()
  const profile = useProfile()
  const router = useRouter()
  const { chainId, isConnected } = useAccount()
  const wrongNetwork = isConnected && chainId !== monadTestnet.id
  const [selection, setSelection] = useState({ address: auth.address, role: "" })
  const role = selection.address === auth.address ? selection.role : ""
  const [logoutError, setLogoutError] = useState("")
  const [guideOpen, setGuideOpen] = useState(false)
  const payer = usePayerSetupStatus(profile.data?.role === "payer")
  useEffect(() => {
    if (
      !auth.ready ||
      !auth.authenticated ||
      !auth.address ||
      auth.connecting ||
      wrongNetwork ||
      !profile.data
    )
      return
    if (profile.data.role !== "payer") router.replace(roleHome[profile.data.role])
    else if (payer.status === "setup") router.replace("/onboarding/payer")
    // If the company check fails, the dashboard shows the error with a retry.
    else if (payer.status === "ready" || payer.status === "error") router.replace("/payer")
  }, [
    auth.ready,
    auth.authenticated,
    auth.address,
    auth.connecting,
    wrongNetwork,
    profile.data,
    payer.status,
    router,
  ])
  const picking =
    auth.ready &&
    !auth.connecting &&
    auth.authenticated &&
    !!auth.address &&
    !wrongNetwork &&
    !profile.isLoading &&
    !profile.error &&
    !profile.data
  if (picking)
    return (
      <RolePicker
        role={role}
        onChange={(id) => setSelection({ address: auth.address, role: id })}
        onContinue={() => router.push(`/onboarding/${role}`)}
      />
    )
  return (
    <div className="w-full max-w-[520px]">
      <Card>
        <div className="space-y-5">
          {!auth.ready ? (
            <p role="status">Checking your account…</p>
          ) : auth.connecting ? (
            <p role="status">
              Finish signing in in the pop-up window. You can close it to return here.
            </p>
          ) : !auth.authenticated ? (
            <>
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-stamp">
                <Wallet size={32} strokeWidth={1.6} aria-hidden />
              </span>
              <h1 className="text-center text-headline font-medium">Welcome to tiba</h1>
              <p className="text-center text-muted-ink">
                Sign in to get started with your wallet or your email. No password needed.
              </p>
              <Button className="w-full" disabled={!auth.configured} onClick={auth.login}>
                Sign in
              </Button>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="mx-auto block min-h-11 text-center text-caption text-stamp-deep underline-offset-4 hover:underline"
              >
                New to wallets? Here’s a 2-minute guide
              </button>
              {!auth.configured && (
                <p className="text-center text-caption text-muted-ink">
                  Connection is not configured yet. Please contact the team.
                </p>
              )}
            </>
          ) : !auth.address ? (
            <>
              <p>Sign in again to finish setting up your account.</p>
              <Button onClick={auth.login}>Sign in</Button>
            </>
          ) : wrongNetwork ? (
            <NetworkCheck />
          ) : profile.isLoading ? (
            <p role="status">Checking your account…</p>
          ) : profile.error ? (
            <div role="alert" className="space-y-4">
              <h2 className="text-heading">We could not check your account</h2>
              <p className="text-danger">{errorMessage(profile.error)}</p>
              <Button onClick={() => profile.refetch()}>Try again</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setLogoutError("")
                  void auth
                    .logout()
                    .catch(() => setLogoutError("We could not sign you out. Please try again."))
                }}
              >
                Sign out
              </Button>
            </div>
          ) : profile.data ? (
            <p role="status">Opening your account…</p>
          ) : null}
          {auth.error && !auth.connecting && (
            <p role="alert" className="text-danger">
              {auth.error}
            </p>
          )}
          {logoutError && (
            <p role="alert" className="text-danger">
              {logoutError}
            </p>
          )}
        </div>
      </Card>
      <Modal
        open={guideOpen}
        onOpenChange={setGuideOpen}
        title="Your wallet, in a few steps"
        description="A wallet is how you sign in and confirm payments."
      >
        <ol className="list-decimal space-y-4 pl-5">
          <li>Choose Sign in, then use your wallet or your email.</li>
          <li>
            Approve the sign-in request in your wallet. You can also connect a mobile wallet with
            WalletConnect.
          </li>
          <li>
            Choose your role to set up your account. Each payment asks for a separate confirmation.
          </li>
        </ol>
        <Button block onClick={() => setGuideOpen(false)}>
          Got it
        </Button>
      </Modal>
    </div>
  )
}

function RolePicker({
  role,
  onChange,
  onContinue,
}: {
  role: string
  onChange: (role: string) => void
  onContinue: () => void
}) {
  const chosen = roles.find((item) => item.id === role)
  return (
    <div className="w-full max-w-[560px] lg:max-w-[1040px]">
      <OnboardingSteps step={0} />
      <div className="space-y-4 px-1 md:space-y-7">
        <div className="space-y-2.5 lg:text-center">
          <h1 className="text-headline font-medium">How will you use tiba?</h1>
          <p className="text-muted-ink">
            <span className="lg:hidden">
              Pick one. You can&apos;t change it later with the same wallet.
            </span>
            <span className="hidden lg:inline">
              Pick one. Your wallet keeps this role, so next time you go straight to your dashboard.
            </span>
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Your role"
          className="grid gap-2.5 lg:grid-cols-3 lg:gap-5"
        >
          {roles.map((item) => {
            const selected = role === item.id
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center gap-3 rounded-[22px] border p-2.5 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp-deep has-[:focus-visible]:ring-offset-2 lg:flex-col lg:items-stretch lg:gap-3.5 lg:rounded-[28px] lg:p-4 lg:pb-7 ${
                  selected ? "border-ink bg-ink text-white" : "border-line bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={item.id}
                  checked={selected}
                  onChange={() => onChange(item.id)}
                  className="sr-only"
                />
                <span
                  className={`relative grid h-20 w-[108px] shrink-0 place-items-center overflow-hidden rounded-[14px] lg:h-[210px] lg:w-full lg:rounded-[20px] ${
                    selected ? "bg-surface" : "bg-canvas"
                  }`}
                >
                  <Image
                    src={`/illustrations/role-${item.id}.svg`}
                    alt=""
                    width={320}
                    height={240}
                    className="h-[102px] w-[136px] max-w-none lg:h-[210px] lg:w-[280px]"
                  />
                  <RoleRadio
                    selected={selected}
                    className="absolute top-3 right-3 hidden lg:grid"
                  />
                </span>
                <span className="min-w-0 flex-1 lg:px-2 lg:pt-1">
                  <span className="block text-[17px] leading-snug font-medium lg:text-[24px] lg:leading-tight">
                    {item.title}
                  </span>
                  <span
                    className={`mt-1 block text-caption lg:mt-2 lg:text-[14px] lg:leading-5 ${
                      selected ? "text-white/75" : "text-muted-ink"
                    }`}
                  >
                    {item.description}
                  </span>
                </span>
                <RoleRadio selected={selected} className="lg:hidden" />
              </label>
            )
          })}
        </div>
        <div className="mx-auto w-full space-y-3.5 lg:w-[360px]">
          <Button className="w-full" disabled={!chosen} onClick={onContinue}>
            {chosen ? `Continue as ${chosen.id}` : "Choose a role"}
          </Button>
          <p className="text-center text-caption text-muted-ink">
            Receiving goods at a warehouse? Use the invite link you got.
          </p>
        </div>
      </div>
    </div>
  )
}

function RoleRadio({ selected, className = "" }: { selected: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid size-[22px] shrink-0 place-items-center rounded-full ${
        selected ? "bg-stamp text-ink" : "border border-line-strong bg-surface"
      } ${className}`}
    >
      {selected && <Check size={14} strokeWidth={2.5} />}
    </span>
  )
}
