"use client"

import { useState } from "react"
import { ArrowDownToLine, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/elements/Button"
import { Card } from "@/components/elements/DataState"
import { Field, CheckField } from "@/components/elements/Form"
import { SearchableSelect } from "@/components/elements/SearchableSelect"
import { PhoneField } from "@/components/elements/PhoneField"
import { Modal } from "@/components/elements/Modal"
import { FanMeter } from "@/components/elements/FanMeter"
import { PersonaAvatar } from "@/components/elements/PersonaAvatar"
import { RouteMap } from "@/components/elements/RouteMap"

export function ComponentPreview() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [country, setCountry] = useState("")
  const [province, setProvince] = useState("")
  const [checked, setChecked] = useState(false)
  const [open, setOpen] = useState(false)
  const [usage, setUsage] = useState(65)
  const [departed, setDeparted] = useState(() => new Date().toISOString())
  return (
    <main id="main-content" className="mx-auto max-w-[1120px] space-y-6 px-4 py-8 md:px-6 md:py-12">
      <header className="space-y-3">
        <h1 className="text-headline font-medium">Built from small parts.</h1>
        <p className="text-label text-muted-ink">tiba · Development preview</p>
        <p className="max-w-prose text-muted-ink">
          Shared controls from the TIBA design system. These examples do not save profiles or send
          payments.
        </p>
      </header>
      <Card>
        <h2 className="mb-6 text-heading">Actions</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setOpen(true)}>Continue</Button>
          <Button
            variant="secondary"
            onClick={() => toast("Preview only. Nothing has been saved.")}
          >
            Show message
          </Button>
          <Button variant="moment" icon={ArrowDownToLine} onClick={() => setOpen(true)}>
            Cash out now
          </Button>
          <Button variant="quiet" onClick={() => setOpen(true)}>
            View details
          </Button>
          <Button variant="icon" icon={Plus} onClick={() => setOpen(true)}>
            Add destination
          </Button>
          <Button disabled>Unavailable</Button>
          <Button loading>Saving profile…</Button>
        </div>
      </Card>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-6 text-heading">A few details</h2>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              setOpen(true)
            }}
          >
            <Field
              label="Full name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              error={name.trim().length < 2 ? "Enter at least two characters." : undefined}
              hint="Use the name you share with your team."
            />
            <PhoneField value={phone} onChange={setPhone} />
            <SearchableSelect
              label="Country"
              value={country}
              onChange={(value) => {
                setCountry(value)
                setProvince("")
              }}
              options={[
                { value: "ID", label: "Indonesia" },
                { value: "SG", label: "Singapore" },
                { value: "MY", label: "Malaysia" },
              ]}
              placeholder="Choose a country"
            />
            <SearchableSelect
              label="Province"
              value={province}
              onChange={setProvince}
              disabled={country !== "ID"}
              placeholder={
                country === "ID" ? "Choose a province" : "Pick Indonesia to preview provinces"
              }
              options={[
                { value: "YO", label: "Yogyakarta" },
                { value: "JT", label: "Central Java" },
                { value: "JB", label: "West Java" },
              ]}
            />
            <Field label="Account reference" value="Assigned after setup" disabled />
            <CheckField checked={checked} onChange={(event) => setChecked(event.target.checked)}>
              I have checked these details.
            </CheckField>
            <Button
              block
              type="submit"
              disabled={name.trim().length < 2 || !phone || !country || !checked}
            >
              Review details
            </Button>
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-6 text-heading">People</h2>
            <div className="flex flex-wrap gap-5">
              {(["payer", "carrier", "investor", "warehouse"] as const).map((role) => (
                <div key={role} className="space-y-2 text-center">
                  <PersonaAvatar role={role} size={48} />
                  <p className="text-label capitalize">{role}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-heading">Room for the next trip</h2>
            <p className="mt-3 mb-6 text-muted-ink">Move the slider to preview the limit states.</p>
            <FanMeter label="Credit limit used" value={usage} />
            <label className="mt-6 block space-y-3">
              <span className="text-label">Limit used: {usage}%</span>
              <input
                aria-label="Limit used"
                className="block min-h-11 w-full accent-ink"
                type="range"
                min="0"
                max="120"
                value={usage}
                onChange={(event) => setUsage(Number(event.target.value))}
              />
            </label>
          </Card>
        </div>
      </div>
      <Card>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-heading">Truck on the road</h2>
          <Button variant="secondary" onClick={() => setDeparted(new Date().toISOString())}>
            Pick up again
          </Button>
        </div>
        <RouteMap
          pickup={{ name: "Jogja", lat: -7.7956, lng: 110.3695 }}
          destination={{ name: "Semarang hub", lat: -6.9667, lng: 110.4203 }}
          route={{
            type: "LineString",
            coordinates: [
              [110.3695, -7.7956],
              [110.2177, -7.4797],
              [110.4033, -7.2647],
              [110.405, -7.1386],
              [110.4203, -6.9667],
            ],
          }}
          simulation={{ startedAt: departed, durationSec: 30 }}
        />
      </Card>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Ready for the next step?"
        description="This preview shows a dialog on desktop and a bottom sheet on mobile."
      >
        <p className="text-muted-ink">
          Try the keyboard, close button, or background to return. Your example details stay on this
          page.
        </p>
        <Button block onClick={() => setOpen(false)}>
          Back to preview
        </Button>
      </Modal>
    </main>
  )
}
