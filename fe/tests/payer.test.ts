import { test } from "node:test"
import assert from "node:assert/strict"
import { isBill, isOverdue, validateShipment } from "../src/modules/payer/data/shipment"
import { Status } from "../src/lib/contracts"
import type { Shipment } from "../src/lib/types"
const now = new Date("2026-10-23T12:00:00").getTime()
const shipment = (status: Status, dueDate = BigInt(Math.floor(now / 1000) - 61)) =>
  ({ status, dueDate }) as Shipment
test("shipment creation validates precision, credit, due date and overdue lock", () => {
  assert.equal(validateShipment("25.123456", "2026-11-22", 25123456n, false, now), undefined)
  for (const amount of ["0", "-1", "1e6", "1.0000001", "25.123457"])
    assert.ok(validateShipment(amount, "2026-11-22", 25123456n, false, now))
  assert.ok(validateShipment("1", "2026-11-22", 1000000n, true, now))
  for (const date of ["2026-10-23", "2027-01-01", "2026-02-31", ""])
    assert.ok(validateShipment("1", date, 1000000n, false, now))
})
test("only financed bills beyond the demo grace period lock new shipments", () => {
  assert.equal(isOverdue(shipment(Status.FINANCED), now), true)
  assert.equal(
    isOverdue(shipment(Status.FINANCED, BigInt(Math.floor(now / 1000) - 59)), now),
    false,
  )
  for (const status of [
    Status.APPROVED,
    Status.IN_TRANSIT,
    Status.DELIVERED,
    Status.DISPUTED,
    Status.REPAID,
  ])
    assert.equal(isOverdue(shipment(status), now), false)
  assert.equal(isBill(shipment(Status.DELIVERED)), true)
  assert.equal(isBill(shipment(Status.FINANCED)), true)
  assert.equal(isBill(shipment(Status.REPAID)), false)
})
