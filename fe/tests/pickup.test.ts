import { test } from "node:test"
import assert from "node:assert/strict"
import { savePickupReceipt } from "../src/lib/pickup"

test("confirmed pickup metadata uses the selected wallet and Privy session", async () => {
  const previous = globalThis.fetch
  const hash = `0x${"a".repeat(64)}` as const
  const address = "0x1111111111111111111111111111111111111111"
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith("/api/trips/1"))
    assert.equal(init?.method, "PATCH")
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token")
    assert.equal(new Headers(init?.headers).get("x-wallet-address"), address)
    assert.deepEqual(JSON.parse(String(init?.body)), { pickupTx: hash })
    return new Response(JSON.stringify({ trip: { picked_up_at: "2026-10-24T05:10:00.000Z" } }), {
      headers: { "content-type": "application/json" },
    })
  }
  try {
    await savePickupReceipt("1", hash, "token", address)
  } finally {
    globalThis.fetch = previous
  }
})
test("pickup metadata failures propagate so transaction recovery is retained", async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Database unavailable" } }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })
  try {
    await assert.rejects(
      savePickupReceipt(
        "1",
        `0x${"a".repeat(64)}`,
        "token",
        "0x1111111111111111111111111111111111111111",
      ),
      /Database unavailable/,
    )
  } finally {
    globalThis.fetch = previous
  }
})
