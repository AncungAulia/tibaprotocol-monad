import { test } from "node:test"
import assert from "node:assert/strict"
import { paymentArgs, readPendingPayment, samePayment } from "../src/lib/transaction-recovery"

test("broadcast payments survive serialization without losing USDC precision", () => {
  const saved = readPendingPayment(
    JSON.stringify({
      hash: `0x${"a".repeat(64)}`,
      action: "deposit",
      args: paymentArgs({ amount: 100000000000000001n }),
    }),
  )!
  assert.equal(saved.args.amount, "100000000000000001")
  assert.equal(samePayment(saved, "deposit", { amount: 100000000000000001n }), true)
  assert.equal(samePayment(saved, "deposit", { amount: 100000000000000002n }), false)
  assert.equal(samePayment(saved, "withdraw", { amount: 100000000000000001n }), false)
})
test("invalid recovery records never become trusted pending payments", () => {
  assert.equal(readPendingPayment(null), undefined)
  for (const raw of [
    "{}",
    "not-json",
    JSON.stringify({ hash: `0x${"a".repeat(64)}`, action: "deposit", args: { amount: "1e6" } }),
  ])
    assert.throws(() => readPendingPayment(raw))
})
