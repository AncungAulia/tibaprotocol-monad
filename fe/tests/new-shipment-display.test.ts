import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { calendarDateValue, calendarDays, calendarKeyboardDate } from "../src/components/elements/DateField"
import { Field } from "../src/components/elements/Form"
import { SearchableSelect } from "../src/components/elements/SearchableSelect"
import { NewShipmentContent } from "../src/modules/payer/components/NewShipmentContent"

const noop = () => {}
const props: ComponentProps<typeof NewShipmentContent> = {
  values: { carrier: "", pickupId: "", destinationId: "", cargo: "", quantity: "", fee: "", due: "" },
  onChange: noop, carriers: [], places: [], amount: 0n, remaining: 600_000_000n,
  creditLimit: 3_000_000_000n, outstanding: 2_400_000_000n,
  valid: false, recoveryReady: true, pending: false, step: "", errors: {}, overdue: false,
  minDate: "2026-10-24", maxDate: "2026-12-23", onSubmit: noop,
}
const render = (extra: Partial<typeof props> = {}) => renderToStaticMarkup(createElement(NewShipmentContent, { ...props, ...extra }))

test("empty summary keeps amounts blank, shows existing credit usage and preserves optional quantity", () => {
  const html = render()
  assert.match(html, /Fill in the trip to see the numbers/)
  assert.match(html, /Number of boxes or items \(optional\)/)
  assert.match(html, /2,400\.00.*?3,000\.00 USDC/)
  assert.match(html, /600\.00 USDC.*?left/)
  assert.match(html, /disabled=""/)
  assert.doesNotMatch(html, /NaN|Infinity|You pay by Nov 21/)
})

test("summary retains 97.5% payout and projects the reservation from actual outstanding credit", () => {
  const html = render({ amount: 300_000_000n, valid: true,
    values: { ...props.values, fee: "300", due: "2026-11-21" },
  })
  assert.match(html, /292\.50 USDC/)
  assert.match(html, /2,700\.00.*?3,000\.00 USDC/)
  assert.match(html, /300\.00 USDC.*?left/)
  assert.match(html, /You pay by Nov 21/)
  assert.doesNotMatch(html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "", /disabled=""/)
})

test("over-limit display shows the true excess and a disabled approval", () => {
  const html = render({ amount: 1_200_000_000n, values: { ...props.values, fee: "1200" } })
  assert.match(html, /3,600\.00.*?3,000\.00 USDC/)
  assert.match(html, /600\.00 USDC.*?over/)
  assert.match(html, /aria-valuetext="120% used"/)
  assert.match(html, /disabled=""/)
})

test("pending and unrecovered forms cannot approve, and transaction errors remain visible", () => {
  const pending = render({ valid: true, pending: true, step: "Approve this shipment in your wallet" })
  assert.match(pending, /Waiting for wallet/)
  assert.match(pending, /disabled=""/)
  assert.match(pending, /Approve this shipment in your wallet/)
  const notReady = render({ valid: true, recoveryReady: false, error: "Could not restore shipment" })
  assert.match(notReady, /disabled=""/)
  assert.match(notReady, /role="alert".*?Could not restore shipment/)
  assert.doesNotMatch(render({ creditLimit: 0n, outstanding: 0n, remaining: 0n }), /NaN|Infinity/)
})

test("currency suffix and select hints are connected to their controls without losing caller descriptions", () => {
  const field = renderToStaticMarkup(createElement(Field, { id: "fee", label: "Shipping fee", suffix: "USDC", hint: "Trip fee", "aria-describedby": "help" }))
  assert.match(field, /aria-describedby="help fee-suffix fee-hint"/)
  assert.match(field, /id="fee-suffix"[^>]*>USDC/)
  const select = renderToStaticMarkup(createElement(SearchableSelect, { label: "Carrier", value: "", options: [], onChange: noop, hint: "Only carriers in your network" }))
  assert.match(select, /aria-describedby="[^"]+-hint"/)
  assert.match(select, /Only carriers in your network/)
})

test("calendar weeks start on Monday and retain leap days and year boundaries", () => {
  for (const month of [new Date(2028, 1, 1), new Date(2026, 11, 1)]) {
    const days = calendarDays(month)
    assert.equal(days[0].getDay(), 1)
    assert.equal(days.at(-1)!.getDay(), 0)
    assert.equal(days.length % 7, 0)
  }
  assert.ok(calendarDays(new Date(2028, 1, 1)).some((d) => calendarDateValue(d) === "2028-02-29"))
  assert.equal(calendarDateValue(new Date(2026, 0, 2)), "2026-01-02")
})

test("calendar arrow and page navigation preserve local dates and clamp short months", () => {
  assert.equal(calendarDateValue(calendarKeyboardDate(new Date(2026, 11, 31), "ArrowRight")!), "2027-01-01")
  assert.equal(calendarDateValue(calendarKeyboardDate(new Date(2026, 0, 31), "PageDown")!), "2026-02-28")
  assert.equal(calendarDateValue(calendarKeyboardDate(new Date(2028, 0, 31), "PageDown")!), "2028-02-29")
  assert.equal(calendarKeyboardDate(new Date(), "Tab"), undefined)
  assert.equal(calendarKeyboardDate(new Date(), "constructor"), undefined)
})
