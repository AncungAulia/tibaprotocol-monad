"use client"

import { useState } from "react"
import StartLayout from "@app/start/layout"
import OnboardingLayout from "@app/onboarding/layout"
import { StartScreen } from "@/modules/onboarding/components/StartScreen"
import { PayerOnboardingScreen } from "@/modules/onboarding/components/PayerOnboardingScreen"
import { InvestorOnboardingScreen } from "@/modules/onboarding/components/InvestorOnboardingScreen"
import { PayerHomeContent } from "@/modules/payer/components/PayerHomeContent"
import { CarrierTripsContent } from "@/modules/carrier/components/CarrierTripsContent"
import { Logo } from "@/components/elements/Logo"
import { PersonaAvatar } from "@/components/elements/PersonaAvatar"
import { navItems } from "@/components/layout/nav-items"
import Link from "next/link"
import { Status } from "@/lib/contracts"
import type { Shipment, Place } from "@/lib/types"

const payer = "0x1111111111111111111111111111111111111111",
  carrier = "0x2222222222222222222222222222222222222222",
  consignee = "0x3333333333333333333333333333333333333333"
const pickup: Place = {
  id: "demo-origin",
  payer_address: payer,
  name: "Jogja",
  address: "Example origin",
  lat: -7.7956,
  lng: 110.3695,
  kind: "pickup",
}
const destination: Place = {
  id: "demo-destination",
  payer_address: payer,
  name: "Semarang",
  address: "Example destination",
  lat: -6.9667,
  lng: 110.4167,
  kind: "destination",
  receiver_address: consignee,
}
function samples(): Shipment[] {
  return [Status.IN_TRANSIT, Status.APPROVED, Status.DELIVERED, Status.FINANCED, Status.REPAID].map(
    (status, index) => ({
      id: String(1041 + index),
      payer,
      carrier,
      consignee,
      status,
      advanced: status >= Status.FINANCED ? 294_000_000n : 0n,
      amount:
        BigInt(status === Status.DELIVERED || status === Status.FINANCED ? 1200 : 300) * 1000000n,
      dueDate: BigInt(Math.floor(Date.now() / 1000) + 86400 * (index + 1)),
      deliveredAt: status >= Status.DELIVERED ? BigInt(Math.floor(Date.now() / 1000) - 86400) : 0n,
      receivedQty: 0,
      trip: {
        shipment_id: String(1041 + index),
        pickup_place: pickup.id,
        destination_place: destination.id,
        cargo: "Example shipment",
        pickup,
        destination,
        payer_name: "PT Maju",
        carrier_name: "Pak Budi",
        code: "AB12CD",
        route_geojson: {
          type: "LineString",
          coordinates: [
            [110.3695, -7.7956],
            [110.39, -7.6],
            [110.42, -7.3],
            [110.4167, -6.9667],
          ],
        },
        location:
          status === Status.IN_TRANSIT
            ? { lat: -7.6, lng: 110.39, recorded_at: new Date().toISOString() }
            : undefined,
      },
    }),
  )
}

export function DesignPreview() {
  const [screen, setScreen] = useState("Connect")
  const [rows] = useState(samples)
  const dashboard = screen === "Payer home" || screen === "Carrier trips"
  const isPayer = screen === "Payer home"
  return (
    <>
      <div className="border-b bg-surface px-4 py-3">
        <p className="text-caption text-muted-ink">
          Development preview. Dashboard data is fictional; links open the real app. Form submission
          is disabled.
        </p>
        <nav aria-label="Preview screen" className="mt-2 flex flex-wrap gap-2">
          {["Connect", "Payer setup", "Investor setup", "Payer home", "Carrier trips"].map(
            (label) => (
              <button
                key={label}
                type="button"
                aria-pressed={screen === label}
                onClick={() => setScreen(label)}
                className={`min-h-11 rounded-full px-4 text-label ${screen === label ? "bg-ink text-white" : "bg-canvas"}`}
              >
                {label}
              </button>
            ),
          )}
        </nav>
      </div>
      {screen === "Connect" && (
        <StartLayout>
          <StartScreen />
        </StartLayout>
      )}
      {screen === "Payer setup" && (
        <OnboardingLayout>
          <PayerOnboardingScreen preview />
        </OnboardingLayout>
      )}
      {screen === "Investor setup" && (
        <OnboardingLayout>
          <InvestorOnboardingScreen preview />
        </OnboardingLayout>
      )}
      {dashboard && (
        <div className="mx-auto max-w-[1280px] space-y-6 px-4 pt-4 pb-24 md:px-6">
          <header className="flex h-14 items-center justify-between md:h-[72px] md:rounded-full md:bg-surface md:px-6">
            <div className="flex items-center gap-6">
              <Logo />
              <div className="hidden gap-4 rounded-full bg-canvas px-4 py-2 text-label md:flex">
                {(isPayer
                  ? ["Home", "Shipments", "Network"]
                  : ["Trips", "Payouts", "Companies"]
                ).map((label, index) => (
                  <span key={label} className={index === 0 ? "font-medium" : "text-muted-ink"}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PersonaAvatar role={isPayer ? "payer" : "carrier"} />
              <span className="hidden text-label sm:block">{isPayer ? "PT Maju" : "Pak Budi"}</span>
            </div>
          </header>
          <main id="main-content">
            {isPayer ? (
              <PayerHomeContent
                name="PT Maju"
                rows={rows}
                creditLimit={3000000000n}
                outstanding={2400000000n}
                paidOnTime="100%"
              />
            ) : (
              <CarrierTripsContent name="Pak Budi" rows={rows} />
            )}
          </main>
          <nav
            aria-label="Dashboard preview navigation"
            className="fixed inset-x-4 bottom-4 z-20 flex justify-between rounded-full bg-ink p-2 shadow-float md:hidden"
          >
            {navItems[isPayer ? "payer" : "carrier"].map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 text-label ${index === 0 ? "bg-stamp text-ink" : "text-white/80"}`}
              >
                <item.icon size={18} aria-hidden />
                <span className={index === 0 ? "" : "sr-only"}>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}
