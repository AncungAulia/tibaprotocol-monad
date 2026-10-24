import { test } from "node:test"
import assert from "node:assert/strict"
import { payerGreeting, billDueLabel } from "../src/modules/payer/components/payer-home-display"
import { Status } from "../src/lib/contracts"
import type { Shipment } from "../src/lib/types"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PayerHomeContent } from "../src/modules/payer/components/PayerHomeContent"
import { RouteMap } from "../src/components/elements/RouteMap"
import { ShipmentRow } from "../src/components/elements/ShipmentRow"

test("payer greeting follows local time, company name and first visit", () => {
  for (const [hour, greeting] of [
    [0, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good evening"],
  ] as const) {
    const now = new Date(2026, 9, 24, hour)
    assert.equal(payerGreeting("PT Maju", false, now), `${greeting}, PT Maju`)
    assert.equal(payerGreeting("PT Maju", true, now), "Welcome, PT Maju")
  }
  assert.equal(payerGreeting(null, false), "Your shipments")
})

test("bill captions preserve the existing overdue grace period", () => {
  const now = Date.UTC(2026, 9, 24, 12)
  const bill = (offset: number, status = Status.FINANCED) =>
    ({ dueDate: BigInt(now / 1000 + offset), status }) as Shipment
  assert.equal(billDueLabel(bill(2 * 86400), now), "Due in 2 days")
  assert.equal(billDueLabel(bill(86400), now), "Due in 1 day")
  assert.equal(billDueLabel(bill(-30), now), "Due today")
  assert.equal(billDueLabel(bill(-61), now), "Less than a day late")
  assert.equal(billDueLabel(bill(-3 * 86400), now), "3 days late")
  assert.equal(billDueLabel(bill(-86400, Status.DELIVERED), now), "Due today")
})

test("home highlights an overdue financed bill even when an older delivered bill exists", () => {
  const now = Math.floor(Date.now() / 1000)
  const rows = [
    {
      id: "1",
      status: Status.DELIVERED,
      dueDate: BigInt(now - 5 * 86400),
      amount: 120_000_000n,
      advanced: 0n,
    },
    {
      id: "2",
      status: Status.FINANCED,
      dueDate: BigInt(now - 3 * 86400),
      amount: 300_000_000n,
      advanced: 294_000_000n,
    },
  ] as Shipment[]
  const html = renderToStaticMarkup(
    createElement(PayerHomeContent, {
      name: "PT Maju",
      rows,
      creditLimit: 3_000_000_000n,
      outstanding: 300_000_000n,
      paidOnTime: "90%",
    }),
  )
  assert.match(html, /Bill for #2 is 3 days late/)
  assert.match(html, /disabled=""[^>]*>.*?New shipment/s)
  assert.match(html, /href="\/payer\/shipments\/2"[^>]*>.*?Pay now/s)
  assert.doesNotMatch(html, /Bill for #1 ·/)
})

test("fleet pill is opt-in and does not announce a moving truck for an empty map", () => {
  const trip = { shipment_id: "1", pickup_place: "", destination_place: "", cargo: "" }
  const fleet = renderToStaticMarkup(createElement(RouteMap, { trips: [trip], fleetLabel: true }))
  const standard = renderToStaticMarkup(createElement(RouteMap, { trips: [trip] }))
  const empty = renderToStaticMarkup(createElement(RouteMap, { trips: [], fleetLabel: true }))
  const standardEmpty = renderToStaticMarkup(createElement(RouteMap, { trips: [] }))
  assert.match(fleet, /1 truck moving/)
  assert.match(standard, /1 active shipment/)
  assert.doesNotMatch(empty, /0 trucks moving|0 active shipments/)
  assert.match(standardEmpty, /0 active shipments/)
})

test("home shipment rows show route, carrier and due date without changing other lists", () => {
  const shipment = {
    id: "1041",
    status: Status.IN_TRANSIT,
    amount: 300_000_000n,
    dueDate: BigInt(Date.UTC(2026, 10, 21, 12) / 1000),
    trip: {
      pickup: { name: "Jogja" },
      destination: { name: "Semarang" },
      carrier_name: "Pak Budi",
      cargo: "Ground coffee",
    },
  } as Shipment
  const standard = renderToStaticMarkup(
    createElement(ShipmentRow, { shipment, href: "/payer/shipments/1041" }),
  )
  const home = renderToStaticMarkup(
    createElement(ShipmentRow, { shipment, href: "/payer/shipments/1041", compact: true }),
  )
  assert.match(standard, /Ground coffee/)
  assert.doesNotMatch(home, /Ground coffee/)
  assert.match(home, /Jogja to Semarang/)
  assert.match(home, /Pak Budi/)
  assert.match(home, /Due Nov 21/)
  assert.match(home, /href="\/payer\/shipments\/1041"/)
})
