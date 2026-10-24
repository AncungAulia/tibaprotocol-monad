"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  CircleAlert,
  FileSearch,
  Hourglass,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/elements/Button"
import { Field } from "@/components/elements/Form"
import { PhoneField } from "@/components/elements/PhoneField"
import { SearchableSelect } from "@/components/elements/SearchableSelect"
import { ApiError } from "@/lib/api"
import { useApiQuery, useProfile } from "@/lib/queries"
import { amountError, errorMessage, nibError } from "@/lib/validation"
import type { Company, Profile } from "@/lib/types"
import { companyRequest } from "@/lib/requests"
import { positiveInteger } from "../data/validation"
import { NetworkCheck, SaveError, SetupFrame, useSetupSave } from "./SetupFrame"
import { useRegions } from "../data/regions"

const empty = {
  company_name: "",
  registration_no: "",
  country: "ID",
  province: "",
  city: "",
  street: "",
  postal_code: "",
  contact_name: "",
  contact_role: "",
  trips_per_month: "",
  spend_per_month: "",
}

export function PayerOnboardingScreen({ preview = false }: { preview?: boolean }) {
  const [form, setForm] = useState(empty)
  const [phone, setPhone] = useState("")
  const [submitted, setSubmitted] = useState<Company | null>(null)
  const [editing, setEditing] = useState(false)
  const { save, pending, error, wrongNetwork } = useSetupSave()
  const profile = useProfile()
  const company = useApiQuery<{ company: Company | null }, Company | null>(
    "/api/payer/company",
    profile.data?.role === "payer",
    false,
    (data) => data.company,
  )
  const { refetch: refetchCompany } = company
  const router = useRouter()
  const review = submitted ?? company.data
  const missingCompany = company.error instanceof ApiError && company.error.status === 404
  useEffect(() => {
    if (review?.review_status !== "in_review") return
    const timer = setInterval(() => {
      refetchCompany().then((result) => {
        if (result.data) setSubmitted(result.data)
      })
    }, 15000)
    return () => clearInterval(timer)
  }, [review?.review_status, refetchCompany])
  function update(key: keyof typeof empty, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }
  const regions = useRegions(form.country, form.province)
  const { countries, provinces, cities } = regions
  const valid =
    Object.values(form).every((value) => !!value.trim()) &&
    !!phone &&
    !nibError(form.registration_no) &&
    positiveInteger(form.trips_per_month) &&
    !amountError(form.spend_per_month)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (preview) return
    if (!valid) return
    if (!profile.data) {
      const created = await save<{ profile: Profile }>("/api/profile", {
        role: "payer",
        name: form.contact_name.trim(),
        phone,
      })
      if (!created) return
    }
    // The pickers keep ISO codes; the company record stores readable place names.
    const readable = {
      ...form,
      country: regions.countryName(form.country),
      province: regions.provinceName(form.province),
    }
    const result = await save<{ company: Company }>(
      "/api/payer/submit",
      companyRequest(readable, phone),
    )
    if (result) {
      setSubmitted(result.company)
      setEditing(false)
    }
  }
  const showReview = !!review && !editing
  const contact = profile.data?.name
  const reviewCopy: { title: string; description: string; icon?: LucideIcon; stamp: string } =
    review?.review_status === "approved"
      ? {
          title: "You're approved",
          description: `${review.company_name} can now approve trips. Your carriers get paid early, up to your limit.`,
          icon: BadgeCheck,
          stamp: "bg-stamp",
        }
      : review?.review_status === "needs_info"
        ? {
            title: "We need one more thing",
            description: "Your review is on hold until this is fixed.",
            icon: FileSearch,
            stamp: "bg-stamp-soft text-stamp-deep",
          }
        : review?.review_status === "in_review"
          ? {
              title: "We're checking your company",
              description: `This usually takes one business day. We'll message ${contact || "you"} on WhatsApp when it's done.`,
              icon: Hourglass,
              stamp: "bg-canvas",
            }
          : { title: "Your company setup", description: "", stamp: "" }
  return (
    <SetupFrame
      role="payer"
      title={showReview ? reviewCopy.title : "Tell us about your company"}
      description={
        showReview
          ? reviewCopy.description
          : "We check every company because investors pay your truck owners before you do. It takes about one business day."
      }
      art={
        showReview && reviewCopy.icon ? (
          <span className={`mb-6 grid size-20 place-items-center rounded-full ${reviewCopy.stamp}`}>
            <reviewCopy.icon size={34} strokeWidth={1.75} aria-hidden />
          </span>
        ) : undefined
      }
      review={showReview}
      preview={preview}
    >
      {company.isLoading ? (
        <p role="status">Checking your company…</p>
      ) : company.error && !missingCompany && !submitted ? (
        <div role="alert" className="space-y-4">
          <p className="text-danger">{errorMessage(company.error)}</p>
          <Button onClick={() => company.refetch()}>Try again</Button>
        </div>
      ) : review && !editing ? (
        <div className="space-y-4">
          {review.review_status === "approved" ? (
            <>
              <section className="@container rounded-[22px] bg-ink px-[22px] py-5 text-white">
                <p className="text-label font-medium text-white/70">Your credit limit</p>
                <p className="mt-1.5 text-hero font-medium tabular-nums [overflow-wrap:anywhere]">
                  {Number(review.credit_limit).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  USDC
                </p>
                <p className="mt-1.5 text-caption text-stamp">Grows as you pay on time</p>
              </section>
              <Button className="w-full" onClick={() => router.replace("/payer")}>
                Go to dashboard
              </Button>
            </>
          ) : review.review_status === "needs_info" ? (
            <>
              <div className="flex gap-2.5 rounded-md bg-stamp-soft px-4 py-3.5">
                <CircleAlert size={18} className="mt-0.5 shrink-0 text-stamp-deep" aria-hidden />
                <p className="text-[13.5px] leading-5">
                  {review.review_note ??
                    "Please review your company information and submit an update."}
                </p>
              </div>
              <Button className="w-full" onClick={() => setEditing(true)}>
                Update details
              </Button>
            </>
          ) : review.review_status === "in_review" ? (
            <>
              <dl className="rounded-[20px] bg-canvas px-[18px] py-1">
                <div className="flex justify-between gap-4 border-b border-line py-3 text-[14px] leading-5">
                  <dt className="text-muted-ink">Company</dt>
                  <dd className="min-w-0 text-right font-medium break-words">
                    {review.company_name}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-3 text-[14px] leading-5">
                  <dt className="text-muted-ink">Status</dt>
                  <dd className="font-medium">In review</dd>
                </div>
              </dl>
              <Button
                className="w-full"
                variant="secondary"
                icon={RefreshCw}
                onClick={() =>
                  company.refetch().then((result) => {
                    if (result.data) setSubmitted(result.data)
                  })
                }
              >
                Check status
              </Button>
            </>
          ) : (
            <p role="alert" className="text-danger">
              We could not read your company review status. Please contact the team.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Company name"
              placeholder="PT Example Logistics"
              autoComplete="organization"
              value={form.company_name}
              onChange={(event) => update("company_name", event.target.value)}
              required
              error={!form.company_name.trim() ? "Enter your company name." : undefined}
            />
            <Field
              label="Business registration number"
              placeholder="13 digits"
              hint="NIB in Indonesia, 13 digits"
              inputMode="numeric"
              maxLength={13}
              value={form.registration_no}
              onChange={(event) => update("registration_no", event.target.value)}
              required
              error={
                nibError(form.registration_no)
                  ? `Should be 13 digits. You've typed ${form.registration_no.replace(/\D/g, "").length}.`
                  : undefined
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <SearchableSelect
              label="Country"
              placeholder="Select country"
              value={form.country}
              options={countries}
              onChange={(country) =>
                setForm((previous) => ({ ...previous, country, province: "", city: "" }))
              }
            />
            {form.country && !provinces.length ? (
              <Field
                label="Province"
                value={form.province}
                required
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, province: event.target.value, city: "" }))
                }
                hint="Enter your area if it is not listed."
              />
            ) : (
              <SearchableSelect
                label="Province"
                placeholder={form.country ? "Choose a province" : "Pick a country first"}
                disabled={!form.country}
                value={form.province}
                options={provinces}
                onChange={(province) =>
                  setForm((previous) => ({ ...previous, province, city: "" }))
                }
              />
            )}
            {form.province && !cities.length ? (
              <Field
                label="City"
                value={form.city}
                required
                onChange={(event) => update("city", event.target.value)}
                hint="Enter your city if it is not listed."
              />
            ) : (
              <SearchableSelect
                label="City"
                placeholder={form.province ? "Choose a city" : "Pick a province first"}
                disabled={!form.province}
                value={form.city}
                options={cities}
                onChange={(city) => update("city", city)}
              />
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <Field
              label="Street address"
              placeholder="Street, number, area"
              autoComplete="street-address"
              value={form.street}
              onChange={(event) => update("street", event.target.value)}
              required
            />
            <Field
              label="Postal code"
              autoComplete="postal-code"
              value={form.postal_code}
              onChange={(event) => update("postal_code", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_180px_1fr]">
            <Field
              label="Contact person"
              placeholder="Full name"
              hint="Who we talk to about invoices"
              autoComplete="name"
              value={form.contact_name}
              onChange={(event) => update("contact_name", event.target.value)}
              required
            />
            <Field
              label="Role"
              placeholder="e.g. Finance"
              autoComplete="organization-title"
              value={form.contact_role}
              onChange={(event) => update("contact_role", event.target.value)}
              required
            />
            <div className="md:col-span-2 lg:col-span-1">
              <PhoneField
                label="Phone or WhatsApp"
                hint="Type it the way you say it, 0812..."
                value={phone}
                onChange={setPhone}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Suffixed suffix="trips">
              <Field
                label="Trips per month"
                placeholder="40"
                hint="Average over the last 3 months"
                inputMode="numeric"
                value={form.trips_per_month}
                onChange={(event) => update("trips_per_month", event.target.value)}
                error={
                  !positiveInteger(form.trips_per_month)
                    ? "Enter a whole number greater than zero."
                    : undefined
                }
                required
              />
            </Suffixed>
            <Suffixed suffix="USDC">
              <Field
                label="Shipping spend per month"
                placeholder="12000"
                hint="Helps us size your credit limit"
                inputMode="decimal"
                value={form.spend_per_month}
                onChange={(event) => update("spend_per_month", event.target.value)}
                error={amountError(form.spend_per_month)}
                required
              />
            </Suffixed>
          </div>
          <NetworkCheck />
          <SaveError error={error} />
          <div className="flex flex-col-reverse items-center justify-between gap-4 md:flex-row">
            <p className="text-center text-label text-muted-ink md:text-left">
              Your details stay private. Investors only see your company name and limit.
            </p>
            <Button
              className="w-full shrink-0 md:w-[240px]"
              type="submit"
              loading={pending}
              disabled={!valid || wrongNetwork || preview}
            >
              {pending ? "Submitting" : "Submit for review"}
            </Button>
          </div>
        </form>
      )}
    </SetupFrame>
  )
}

/** Unit shown inside the right edge of a field (Pencil "Suffix"), level with the 52px input. */
function Suffixed({ suffix, children }: { suffix: string; children: ReactNode }) {
  return (
    <div className="relative [&_input]:pr-16">
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[52px] right-4 -translate-y-1/2 text-label text-muted-ink"
      >
        {suffix}
      </span>
    </div>
  )
}
