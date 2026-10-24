import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Status } from "../src/lib/contracts"
import { Timeline } from "../src/components/elements/Timeline"
import { RouteMap } from "../src/components/elements/RouteMap"
import { BillPaidContent, BillPaymentContent } from "../src/modules/payer/components/BillPaymentContent"
import { ShipmentDetailContent } from "../src/modules/payer/components/ShipmentDetailContent"
import { scenarios } from "../src/dev/preview/scenarios"

const sample = scenarios.payer.shipments!.find((s) => s.id === "1044")!
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element)
const noop = () => {}

test("detail shows the route as its title, key/value rows and only applicable bill actions", () => {
  const approved = render(createElement(ShipmentDetailContent, { shipment: { ...sample, status: Status.APPROVED }, onPay: noop }))
  assert.match(approved, /<h1[^>]*>Gudang Jogja to Semarang hub<\/h1>/)
  assert.match(approved, /<dt[^>]*>Shipping fee<\/dt>/)
  assert.doesNotMatch(approved, /Your bill|Pay early/)
  const financed = render(createElement(ShipmentDetailContent, { shipment: sample, onPay: noop }))
  assert.match(financed, /Pay early/)
  assert.doesNotMatch(financed, /· due in/)
  const disputed = render(createElement(ShipmentDetailContent, { shipment: { ...sample, status: Status.DISPUTED, advanced: 0n }, onPay: noop }))
  assert.match(disputed, /Bill on hold/)
  assert.match(disputed, /Read the report/)
  assert.doesNotMatch(disputed, />Pay early<|>Pay now</)
  const withReport = render(createElement(ShipmentDetailContent, {
    shipment: { ...sample, trip: { ...sample.trip!, report: { issues: ["damaged"], received_qty: 0, note: "Damaged goods" } } }, onPay: noop,
  }))
  assert.match(withReport, /Read the report/)
})

test("progress marks the next stage current and completed shipments have no next stage", () => {
  for (const [status, expected] of [
    [Status.APPROVED, "Picked up by Pak Budi"],
    [Status.IN_TRANSIT, "Arrived at Semarang hub"],
    [Status.DELIVERED, "Pak Budi paid early"],
    [Status.FINANCED, "You repaid"],
  ] as const) {
    const html = render(createElement(Timeline, { shipment: { ...sample, status }, payer: true }))
    assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1)
    assert.match(html, new RegExp(`aria-current="step".*?${expected}`))
  }
  const repaid = render(createElement(Timeline, { shipment: { ...sample, status: Status.REPAID }, payer: true }))
  assert.doesNotMatch(repaid, /aria-current/)
})

test("disputed progress places payment on hold after arrival and direct payments do not claim an advance", () => {
  const disputed = render(createElement(Timeline, { shipment: { ...sample, status: Status.DISPUTED, advanced: 0n }, payer: true }))
  assert.match(disputed, /aria-current="step".*?Pak Budi paid early.*?On hold/)
  const direct = render(createElement(Timeline, { shipment: { ...sample, status: Status.REPAID, advanced: 0n } }))
  assert.match(direct, /Carrier payment settled/)
  assert.doesNotMatch(direct, /Carrier paid early/)
})

test("timeline omits unavailable timestamps rather than inventing event dates", () => {
  const html = render(createElement(Timeline, { shipment: { ...sample, deliveredAt: 0n, trip: { ...sample.trip!, picked_up_at: "bad-date" } } }))
  assert.doesNotMatch(html, /Invalid Date|08:02|15:37|1970/)
  assert.match(html, /Approved by company/)
})

test("payment displays exact wallet shortfall and prevents submission when balance is unavailable or insufficient", () => {
  for (const balance of [undefined, 120_000_000n]) {
    const html = render(createElement(BillPaymentContent, {
      shipment: sample, balance, transaction: { pending: false, step: "" }, onPay: noop,
    }))
    assert.match(html, /disabled=""/)
    assert.match(html, /Pay 600\.00 USDC/)
    if (balance === undefined) assert.match(html, /Balance unavailable/)
    else assert.match(html, /You need 480\.00 USDC more/)
  }
})

test("wallet step display follows the actual approval stage and keeps transaction errors", () => {
  const props = { shipment: sample, balance: 1_000_000_000n, onPay: noop }
  const allowing = render(createElement(BillPaymentContent, { ...props, transaction: { pending: true, step: "1 of 2: allow this amount in your wallet" } }))
  assert.doesNotMatch(allowing, /Done in your wallet/)
  assert.match(allowing, /aria-current="step".*?Allow the payment/)
  const sending = render(createElement(BillPaymentContent, { ...props, transaction: { pending: true, step: "2 of 2: confirm the payment in your wallet" } }))
  assert.match(sending, /Done in your wallet/)
  assert.match(sending, /aria-current="step".*?Send 600\.00 USDC/)
  assert.match(sending, /disabled=""/)
  const failed = render(createElement(BillPaymentContent, { ...props, transaction: { pending: false, step: "", error: "Payment cancelled" } }))
  assert.match(failed, /role="alert".*?Payment cancelled/)
  assert.doesNotMatch(failed, /disabled=""/)
})

test("confirmation uses supplied account totals and receipt without inventing repayment timestamps", () => {
  const html = render(createElement(BillPaidContent, {
    shipment: sample,
    account: { creditLimit: 3_000_000_000n, outstanding: 2_100_000_000n, repaidCount: 10n, lateCount: 0n },
    hash: `0x${"a".repeat(64)}`, onDone: noop,
  }))
  assert.match(html, /900\.00 USDC/)
  assert.match(html, /100% · 10 of 10 bills/)
  assert.match(html, /View receipt/)
  assert.doesNotMatch(html, /one day early|record went up|10:12/)
})

test("detail map labels are optional and preserve the standard route preview", () => {
  assert.match(render(createElement(RouteMap, { label: "Location paused" })), /Location paused/)
  assert.match(render(createElement(RouteMap, {})), /Direct route preview/)
})

test("paused preview disables live sources and retains a recorded last position", () => {
  const paused = scenarios["payer-paused"].shipments!.find((s) => s.id === "1041")!
  assert.equal(paused.trip?.share_location, false)
  assert.equal(paused.trip?.simulation, null)
  assert.equal(paused.trip?.channel, null)
  assert.ok(paused.trip?.location?.recorded_at)
  assert.ok(scenarios.payer.shipments!.find((s) => s.id === "1041")!.trip?.simulation)
})
