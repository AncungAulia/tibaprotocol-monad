"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Image from "next/image"
import { ArrowDownToLine, Link2, Send } from "lucide-react"
import { Button, ButtonLink } from "@/components/elements/Button"
import { Field } from "@/components/elements/Form"
import { PhoneField } from "@/components/elements/PhoneField"
import { useAuth } from "@/providers/AuthProvider"
import { plateError } from "@/lib/validation"
import type { Profile } from "@/lib/types"
import { profileLink } from "@/modules/profile/data/public-profile"
import { NetworkCheck, SaveError, SetupFrame, useSetupSave } from "./SetupFrame"

export function CarrierOnboardingScreen() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [plate, setPlate] = useState("")
  const [invite, setInvite] = useState("")
  const [saved, setSaved] = useState<Profile | null>(null)
  const [origin, setOrigin] = useState("")
  const { save, pending, error, wrongNetwork } = useSetupSave()
  const auth = useAuth()
  const router = useRouter()
  useEffect(() => {
    setInvite(new URLSearchParams(window.location.search).get("invite") ?? "")
    setOrigin(window.location.origin)
  }, [])
  const valid = !!name.trim() && !!phone && !plateError(plate)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    const result = await save<{ profile: Profile }>("/api/profile", {
      role: "carrier",
      name: name.trim(),
      phone,
      plate: plate.trim().toUpperCase(),
    })
    if (result) {
      if (invite) router.replace(`/join/${encodeURIComponent(invite)}`)
      else setSaved(result.profile)
    }
  }
  const owner = saved?.address ?? auth.address
  const profileUrl = origin && owner ? profileLink(origin, owner) : ""
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function"
  async function copy() {
    try {
      await navigator.clipboard.writeText(profileUrl)
      toast.success("Profile link copied")
    } catch {
      toast.error("Could not copy. Please copy the link below.")
    }
  }
  async function share() {
    try {
      await navigator.share({ title: `${name} on tiba`, url: profileUrl })
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return
      await copy()
    }
  }
  const whatsapp = profileUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Add me as your carrier on tiba: ${profileUrl}`)}`
    : ""
  return (
    <SetupFrame
      role="carrier"
      review={!!saved}
      art={
        saved ? (
          <div className="mb-6 grid h-[210px] w-full max-w-[280px] place-items-center overflow-hidden rounded-[20px] bg-canvas">
            <Image src="/illustrations/role-carrier.svg" alt="" width={280} height={210} />
          </div>
        ) : undefined
      }
      title={saved ? "You're ready to roll" : "A bit about you and your truck"}
      description={
        saved
          ? "Send your link to the shipping companies you work with. Once they connect, their trips show up here."
          : "Shipping companies see this when they hire you. Takes about a minute."
      }
    >
      {saved ? (
        <div className="space-y-4">
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
              <ButtonLink href={whatsapp} target="_blank" icon={Send} className="w-full">
                Share on WhatsApp
              </ButtonLink>
              {canShare && (
                <Button variant="secondary" className="w-full" onClick={share}>
                  Share link
                </Button>
              )}
            </>
          )}
          <Button
            variant="quiet"
            icon={null}
            className="w-full bg-canvas"
            onClick={() => router.replace("/carrier")}
          >
            Go to my trips
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <Field
            label="Full name"
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            error={!name.trim() ? "Enter your name." : undefined}
          />
          <PhoneField
            label="Phone or WhatsApp"
            hint="Type it the way you say it, 0812..."
            value={phone}
            onChange={setPhone}
          />
          <Field
            label="Truck plate number"
            placeholder="AB 1234 CD"
            hint="As written on the plate"
            autoCapitalize="characters"
            value={plate}
            onChange={(event) => setPlate(event.target.value.toUpperCase())}
            error={plateError(plate) ? "Use the format on your plate, like AB 1234 CD." : undefined}
            required
          />
          <div className="flex items-center gap-3 rounded-md bg-canvas px-4 py-3.5">
            <ArrowDownToLine size={18} className="shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-[14px] leading-5 font-medium">Payments go to this wallet</p>
              <p className="text-caption text-muted-ink">The one you just connected</p>
            </div>
          </div>
          <NetworkCheck />
          <SaveError error={error} />
          <Button
            type="submit"
            className="w-full"
            loading={pending}
            disabled={!valid || wrongNetwork}
          >
            {pending ? "Saving your details" : "Finish setup"}
          </Button>
        </form>
      )}
    </SetupFrame>
  )
}
