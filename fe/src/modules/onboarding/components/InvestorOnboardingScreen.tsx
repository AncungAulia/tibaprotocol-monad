"use client"

import { ArrowDownToLine, Hourglass, Wallet } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/elements/Button"
import { CheckField, Field } from "@/components/elements/Form"
import type { Profile } from "@/lib/types"
import { useProfile } from "@/lib/queries"
import { poolEarnLabel } from "@/modules/investor/data/math"
import { NetworkCheck, SaveError, SetupFrame, useSetupSave } from "./SetupFrame"

export function InvestorOnboardingScreen({ preview = false }: { preview?: boolean }) {
  const [understood, setUnderstood] = useState(false)
  const [name, setName] = useState("")
  const { save, pending, error, wrongNetwork } = useSetupSave()
  const router = useRouter()
  const profile = useProfile()
  useEffect(() => {
    if (profile.data?.role === "investor") router.replace("/pool")
  }, [profile.data, router])
  async function finish() {
    if (!understood || preview) return
    const result = await save<{ profile: Profile }>("/api/profile", {
      role: "investor",
      ...(name.trim() ? { name: name.trim() } : {}),
    })
    if (result) router.replace("/pool")
  }
  return (
    <SetupFrame
      role="investor"
      title="Before you deposit"
      description="Three things worth knowing. Takes 30 seconds."
      preview={preview}
    >
      <div className="space-y-6">
        <ol className="space-y-2.5">
          {[
            [
              "Your money pays truck owners early",
              `You earn when the shipping company pays the bill, about ${poolEarnLabel()} per trip.`,
            ],
            [
              "Some bills get paid late",
              "If a company pays late or doesn't pay, you could lose part of your money.",
            ],
            ["Withdraw anytime", "From the part of the pool that isn't paid out yet."],
          ].map(([title, description], index) => (
            <li key={title} className="flex items-center gap-3.5 rounded-[18px] bg-canvas p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface">
                {index === 0 ? (
                  <ArrowDownToLine size={17} aria-hidden />
                ) : index === 1 ? (
                  <Hourglass size={17} aria-hidden />
                ) : (
                  <Wallet size={17} aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <h2 className="font-medium">{title}</h2>
                <p className="mt-0.5 text-label text-muted-ink">{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <Field
          label="Your name (optional)"
          hint="Shown in your account menu."
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <CheckField checked={understood} onChange={(event) => setUnderstood(event.target.checked)}>
          I understand how the pool works
        </CheckField>
        <NetworkCheck />
        <SaveError error={error} />
        <Button
          className="w-full"
          loading={pending}
          disabled={!understood || wrongNetwork || preview}
          onClick={finish}
        >
          {pending ? "Saving your account…" : "Continue"}
        </Button>
      </div>
    </SetupFrame>
  )
}
