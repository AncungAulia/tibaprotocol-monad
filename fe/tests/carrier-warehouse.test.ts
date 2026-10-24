import { test } from "node:test"
import assert from "node:assert/strict"
import { scannedShipmentId, quantityError } from "../src/modules/warehouse/data/validation"

test("QR scanning accepts shipment confirmation links from any copy of the app", () => {
  const origin = "https://tiba.example"
  assert.equal(scannedShipmentId(`${origin}/confirm/0`, origin), "0")
  assert.equal(scannedShipmentId("/confirm/123/", origin), "123")
  assert.equal(scannedShipmentId("https://tiba-git-preview.vercel.app/confirm/7", origin), "7")
  assert.equal(scannedShipmentId("http://192.168.1.20:3000/confirm/8", origin), "8")
  assert.equal(scannedShipmentId("42", origin), "42")
  for (const value of [
    "https://user:pass@tiba.example/confirm/1",
    "ftp://tiba.example/confirm/1",
    "https://tiba.example/other/1",
    "042",
    "javascript:alert(1)",
    "/confirm/1?redirect=https://evil.example",
    "/confirm/1#x",
    "/confirm/-1",
    "/confirm/01",
    "/confirm/abc",
    "/carrier",
  ])
    assert.throws(() => scannedShipmentId(value, origin))
})
test("received quantities preserve zero and reject invalid or excessive amounts", () => {
  for (const value of ["", "-1", "1.5", "1e2", "4294967296", "NaN"]) assert.ok(quantityError(value))
  assert.equal(quantityError("0", 120), undefined)
  assert.equal(quantityError("120", 120), undefined)
  assert.ok(quantityError("121", 120))
  assert.equal(quantityError("4294967295"), undefined)
})
