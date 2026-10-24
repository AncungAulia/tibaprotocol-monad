import { test } from "node:test"
import assert from "node:assert/strict"
import { Status } from "../src/lib/contracts"
import { payoutAmount, payouts } from "../src/modules/carrier/data/payouts"
import { estimateText, isArriving, tripEstimate } from "../src/modules/carrier/data/estimate"
import { issueLabel, issueLabels } from "../src/modules/warehouse/data/report"
import { financingBreakdown } from "../src/modules/investor/data/math"

const row = (id: string, status: Status, advanced: bigint, amount = 300000000n) => ({
  id,
  status,
  advanced,
  amount,
})

test("payouts stay listed after repayment and count direct payments in full", () => {
  assert.equal(payoutAmount(row("1", Status.FINANCED, 294000000n)), 294000000n)
  assert.equal(payoutAmount(row("2", Status.REPAID, 294000000n)), 294000000n)
  assert.equal(payoutAmount(row("3", Status.REPAID, 0n)), 300000000n)
  assert.equal(payoutAmount(row("4", Status.DELIVERED, 0n)), undefined)
  const list = payouts([row("1", Status.FINANCED, 1n), row("3", Status.REPAID, 0n, 5n)])
  assert.deepEqual(
    list.map((p) => [p.shipment.id, p.amount]),
    [
      ["3", 5n],
      ["1", 1n],
    ],
  )
})

test("demo trips count down distance and time from the simulation", () => {
  const start = Date.parse("2026-10-23T10:00:00Z")
  const trip = {
    distance_km: 100,
    duration_min: 120,
    simulation: { startedAt: new Date(start).toISOString(), durationSec: 600 },
  }
  const half = tripEstimate(trip, start + 300000)
  assert.equal(half.kmLeft, 50)
  assert.equal(half.minutesLeft, 5)
  assert.equal(isArriving(half, true), false)
  assert.equal(isArriving(tripEstimate(trip, start + 550000), true), true)
  assert.equal(estimateText(half, true), "About 5 min to arrival · 50 km left")
})

test("without a simulation the route totals are shown", () => {
  const estimate = tripEstimate({ distance_km: 120, duration_min: 130 })
  assert.equal(estimateText(estimate, false), "120 km trip, about 2 h 10 min on the road")
  assert.equal(estimateText(tripEstimate(undefined), false), undefined)
  const pickedUp = Date.parse("2026-10-23T10:00:00Z")
  const late = tripEstimate(
    { duration_min: 60, picked_up_at: new Date(pickedUp).toISOString() },
    pickedUp + 55 * 60000,
  )
  assert.equal(isArriving(late, true), true)
  assert.equal(isArriving(late, false), false)
})

test("report issues read as plain labels", () => {
  assert.equal(issueLabel("missing_items"), "Missing items")
  assert.equal(issueLabel("Wrong goods"), "Wrong goods")
  assert.equal(issueLabels(["damaged", "other"]), "Damaged, Other")
})

test("pool share uses the amount actually paid early", () => {
  assert.deepEqual(financingBreakdown(300000000n, 294000000n), {
    paidToCarrier: 294000000n,
    pool: 4800000n,
    treasury: 1200000n,
  })
})
