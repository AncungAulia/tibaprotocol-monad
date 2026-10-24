import { test } from "node:test"
import assert from "node:assert/strict"
import { amountError, nibError, plateError, dueDateError, canAct } from "../src/lib/validation"

test("USDC rejects rounded precision, invalid amounts and amounts above the available funds", () => {
  for (const value of ["", "-1", "1e6", "0", "0.0000001", "NaN"]) assert.ok(amountError(value))
  assert.equal(amountError("25.123456", 25123456n), undefined)
  assert.ok(amountError("25.123457", 25123456n))
})
test("company and carrier registration formats", () => {
  assert.equal(nibError("1234567890123"), undefined)
  assert.ok(nibError("123"))
  assert.equal(plateError("AB 1234 CD"), undefined)
  assert.ok(plateError("a truck"))
})
test("shipment actions cannot bypass arrival or repeat payments", () => {
  assert.equal(canAct(1, "pickup"), true)
  assert.equal(canAct(2, "confirm"), true)
  assert.equal(canAct(3, "advance"), true)
  for (const status of [0, 1, 2, 4, 5, 6]) assert.equal(canAct(status, "advance"), false)
  assert.equal(canAct(6, "repay"), false)
  assert.equal(canAct(4, "repay"), false)
})
test("due dates must be in the next 60 days", () => {
  const now = new Date("2026-10-23T12:00:00").getTime()
  assert.equal(dueDateError("2026-11-22", now), undefined)
  assert.ok(dueDateError("2026-10-22", now))
  assert.ok(dueDateError("2027-01-01", now))
})
