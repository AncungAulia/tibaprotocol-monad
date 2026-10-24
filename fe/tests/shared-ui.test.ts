import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "../src/components/elements/Button"
import { Field } from "../src/components/elements/Form"
import { PhoneField } from "../src/components/elements/PhoneField"
import { FanMeter } from "../src/components/elements/FanMeter"
import { activeNavHref, navItems } from "../src/components/layout/nav-items"

test("a busy button blocks repeat clicks and does not implicitly submit forms", () => {
  const markup = renderToStaticMarkup(createElement(Button, { loading: true }, "Saving profile"))
  assert.match(markup, /type="button"/)
  assert.match(markup, /disabled=""/)
  assert.match(markup, /aria-busy="true"/)
  assert.match(markup, /Saving profile/)
})

test("untouched required fields keep their hint and accessible caller IDs", () => {
  const markup = renderToStaticMarkup(
    createElement(Field, {
      id: "company-name",
      label: "Company name",
      value: "",
      readOnly: true,
      error: "Enter your company name.",
      hint: "Use your registered name.",
      "aria-describedby": "extra-help",
    }),
  )
  assert.match(markup, /for="company-name"/)
  assert.match(markup, /aria-describedby="extra-help company-name-hint"/)
  assert.doesNotMatch(markup, /Enter your company name/)
})

test("an existing international phone initializes its own country and national number", () => {
  const markup = renderToStaticMarkup(
    createElement(PhoneField, { value: "+6581234567", onChange: () => {} }),
  )
  assert.match(markup, /value="8123 4567"/)
  assert.doesNotMatch(markup, /0812 3456 7890/)
  assert.doesNotMatch(markup, /Enter a valid phone number/)
})

test("nav highlights the deepest matching item and the role home only when nothing deeper matches", () => {
  const items = navItems.payer
  assert.equal(activeNavHref("/payer", items), "/payer")
  assert.equal(activeNavHref("/payer/shipments", items), "/payer/shipments")
  assert.equal(activeNavHref("/payer/shipments/123", items), "/payer/shipments")
  assert.equal(activeNavHref("/payer/new", items), "/payer")
  assert.equal(activeNavHref("/payer/shipmentsx", items), "/payer")
  assert.equal(activeNavHref("/carrier", items), undefined)
})

test("large fan meter draws 16 bars with a legend and keeps the 90% warning", () => {
  const markup = renderToStaticMarkup(
    createElement(FanMeter, { value: 80, label: "Credit used", size: "lg" }),
  )
  assert.equal(markup.match(/data-filled/g)?.length, 16)
  assert.equal(markup.match(/data-filled="true"/g)?.length, 13)
  assert.match(markup, /In use/)
  assert.match(markup, /Free/)
  assert.doesNotMatch(markup, /bg-warning/)
  const high = renderToStaticMarkup(
    createElement(FanMeter, { value: 95, label: "Credit used", size: "lg" }),
  )
  assert.match(high, /bg-warning/)
  const small = renderToStaticMarkup(createElement(FanMeter, { value: 50, label: "Credit used" }))
  assert.equal(small.match(/data-filled/g)?.length, 40)
})
