"use client"

import { useEffect, useRef, useState, useId } from "react"
import { ChevronDown } from "lucide-react"
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js"
import { SearchableSelect } from "./SearchableSelect"
import { inputClass, useFieldFeedback } from "./Form"
import { cn } from "@/lib/utils"

const names = new Intl.DisplayNames(["en"], { type: "region" })
const options = getCountries()
  .map((code) => ({ value: code, label: `${names.of(code)} +${getCountryCallingCode(code)}` }))
  .sort((a, b) => a.label.localeCompare(b.label))
/**
 * Country flag as a small local SVG (public/flags, from the MIT flag-icons set). Emoji flags
 * render as two letters on Windows, so we never use them.
 */
export function Flag({ country, className }: { country: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${country.toLowerCase()}.svg`}
      alt=""
      width={22}
      height={15}
      loading="lazy"
      className={cn(
        "h-[15px] w-[22px] shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]",
        className,
      )}
    />
  )
}

function phoneError(local: string, country: CountryCode) {
  if (parsePhoneNumberFromString(local, country)?.isValid()) return undefined
  const length = local.replace(/\D/g, "") ? validatePhoneNumberLength(local, country) : undefined
  const place = names.of(country) ?? "this country"
  if (length === "TOO_SHORT") return `Too short for a number in ${place}.`
  if (length === "TOO_LONG") return `Too long for a number in ${place}.`
  return "Enter a valid phone number for the selected country."
}

export function PhoneField({
  value,
  onChange,
  label = "Phone number",
  hint,
  disabled = false,
}: {
  value: string
  onChange: (e164: string) => void
  label?: string
  hint?: string
  disabled?: boolean
}) {
  const initial = parsePhoneNumberFromString(value)
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? "ID")
  const [local, setLocal] = useState(initial?.formatNational() ?? value)
  const emitted = useRef(value)
  const id = useId()
  const parsed = parsePhoneNumberFromString(local, country)
  const feedback = useFieldFeedback(phoneError(local, country), `${country}:${local}`)
  useEffect(() => {
    if (value === emitted.current) return
    const phone = parsePhoneNumberFromString(value)
    setCountry(phone?.country ?? "ID")
    setLocal(phone?.formatNational() ?? value)
    emitted.current = value
  }, [value])
  function update(number: string, code: CountryCode) {
    feedback.onChange()
    setLocal(number)
    const phone = parsePhoneNumberFromString(number, code)
    setCountry(phone?.country ?? code)
    emitted.current = phone?.isValid() ? phone.number : ""
    onChange(emitted.current)
  }
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-label font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-[52px] min-w-0 items-center rounded-md border bg-canvas pl-1.5",
          feedback.message ? "border-danger" : "border-transparent",
          disabled && "opacity-60",
        )}
      >
        <SearchableSelect
          label="Country calling code"
          hideLabel
          value={country}
          options={options}
          disabled={disabled}
          selectedLabel={
            <span className="inline-flex items-center gap-2 font-medium whitespace-nowrap">
              <Flag country={country} />+{getCountryCallingCode(country)}
              <ChevronDown size={14} className="text-muted-ink" aria-hidden />
            </span>
          }
          className="min-h-10 w-auto shrink-0 gap-2 rounded-sm border-0 bg-transparent px-2.5 py-0 disabled:opacity-100 [&>svg:last-child]:hidden"
          onChange={(code) =>
            update(
              local.startsWith("+") ? (parsed?.nationalNumber ?? local) : local,
              code as CountryCode,
            )
          }
        />
        <span className="h-6 w-px shrink-0 bg-line-strong" aria-hidden />
        <input
          id={id}
          type="tel"
          autoComplete="tel-national"
          className={cn(
            inputClass,
            "min-w-0 flex-1 rounded-l-none border-0 bg-transparent pl-3 disabled:opacity-100",
          )}
          disabled={disabled}
          value={local}
          onChange={(event) => update(event.target.value, country)}
          onBlur={feedback.onBlur}
          placeholder={country === "ID" ? "0812 3456 7890" : "Phone number"}
          aria-invalid={!!feedback.message}
          aria-describedby={feedback.message || hint ? `${id}-error` : undefined}
        />
      </div>
      {feedback.message || hint ? (
        <p
          id={`${id}-error`}
          aria-live="polite"
          className={cn("text-caption", feedback.message ? "text-danger" : "text-muted-ink")}
        >
          {feedback.message || hint}
        </p>
      ) : null}
    </div>
  )
}
