"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAccount, useSwitchChain } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/elements/Button"
import { Card, QueryState } from "@/components/elements/DataState"
import { useAuth } from "@/providers/AuthProvider"
import { useProfile } from "@/lib/queries"
import { api } from "@/lib/api"
import { monadTestnet } from "@/lib/chain"
import { errorMessage } from "@/lib/validation"
import { roleHome, type Role } from "@/types/role"
import { OnboardingSteps } from "./OnboardingSteps"

export function SetupFrame({
  title,
  description,
  role,
  children,
  review = false,
  preview = false,
  art,
}: {
  art?: ReactNode
  title: string
  description: string
  role: Role
  children: ReactNode
  review?: boolean
  preview?: boolean
}) {
  const profile = useProfile()
  const router = useRouter()
  useEffect(() => {
    if (profile.data && profile.data.role !== role) router.replace(roleHome[profile.data.role])
  }, [profile.data, role, router])
  // The payer form is two columns wide; status screens use the narrow card.
  const wide = role === "payer" && !review
  const content = (
    <div className={`w-full ${wide ? "max-w-[900px]" : "max-w-[520px]"}`}>
      <OnboardingSteps role={role} step={review ? 2 : 1} />
      {profile.data && profile.data.role !== role ? (
        <p role="status">Opening your account…</p>
      ) : (
        // Phones show the form straight on the white page (Pencil mobile frames);
        // from md up it sits in a white card on the grey canvas.
        <Card className="rounded-none bg-transparent p-1 md:rounded-[32px] md:bg-surface md:p-10">
          {art}
          <h1 className={`text-headline font-medium ${wide ? "max-w-[14ch]" : ""}`}>{title}</h1>
          {description && <p className="mt-2.5 mb-6 text-muted-ink">{description}</p>}
          {children}
        </Card>
      )}
    </div>
  )
  return preview && process.env.NODE_ENV === "development" ? (
    content
  ) : (
    <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()}>
      {content}
    </QueryState>
  )
}

export function NetworkCheck() {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending, error } = useSwitchChain()
  if (!isConnected || chainId === monadTestnet.id) return null
  return (
    <div className="space-y-3 rounded-2xl bg-stamp-soft p-4">
      <p>Switch your wallet to the supported network to continue.</p>
      <Button
        type="button"
        variant="secondary"
        disabled={isPending}
        onClick={() => switchChain({ chainId: monadTestnet.id })}
      >
        {isPending ? "Waiting for wallet…" : "Switch network"}
      </Button>
      {error && (
        <p role="alert" className="text-danger">
          {errorMessage(error)}
        </p>
      )}
    </div>
  )
}

export function useSetupSave() {
  const auth = useAuth()
  const { chainId, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const wrongNetwork = isConnected && chainId !== monadTestnet.id
  async function save<T>(path: string, body: Record<string, unknown>): Promise<T | undefined> {
    if (pending || wrongNetwork) return
    setPending(true)
    setError("")
    try {
      if (!auth.address) throw new Error("Sign in before continuing.")
      const token = await auth.getAccessToken()
      if (!token) throw new Error("Your session expired. Sign in again to continue.")
      const result = await api<T>(path, {
        method: "POST",
        token,
        walletAddress: auth.address,
        body,
      })
      await queryClient.invalidateQueries({ queryKey: ["profile"] })
      return result
    } catch (cause) {
      setError(errorMessage(cause))
      return undefined
    } finally {
      setPending(false)
    }
  }
  return { save, pending, error, wrongNetwork }
}

export function SaveError({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="text-danger">
      {error}
    </p>
  ) : null
}
