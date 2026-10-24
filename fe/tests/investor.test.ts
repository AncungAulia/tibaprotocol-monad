import { test } from "node:test"
import assert from "node:assert/strict"
import { ADVANCE_BPS, BPS, PROTOCOL_SHARE_BPS } from "@tiba/sc"
import {
  sharesForWithdrawal,
  financingBreakdown,
  poolEarnPercent,
} from "../src/modules/investor/data/math"
import { formatUnits } from "viem"
import { amountError } from "../src/lib/validation"

test("Max keeps all six USDC decimal places without rounding above the balance", () => {
  assert.equal(formatUnits(1005000n, 6), "1.005")
  assert.equal(amountError(formatUnits(1005000n, 6), 1005000n), undefined)
})

test("withdrawal rounds shares down so the requested available amount is never exceeded", () => {
  assert.equal(sharesForWithdrawal(50000000n, 101600000n, 100000000n), 49212598n)
  const shares = sharesForWithdrawal(1n, 3n, 2n)
  assert.equal(shares, 0n)
  assert.equal(sharesForWithdrawal(1n, 0n, 0n), 0n)
})
test("a 300 USDC bill splits by the contract fee constants using integer arithmetic", () => {
  const amount = 300000000n
  const paidToCarrier = (amount * BigInt(ADVANCE_BPS)) / BigInt(BPS)
  const spread = amount - paidToCarrier
  const treasury = (spread * BigInt(PROTOCOL_SHARE_BPS)) / BigInt(BPS)
  assert.deepEqual(financingBreakdown(amount), {
    paidToCarrier,
    pool: spread - treasury,
    treasury,
  })
  const result = financingBreakdown(51n)
  assert.equal(result.paidToCarrier + result.pool + result.treasury, 51n)
})
test("a financed shipment keeps the advanced amount recorded on chain", () => {
  const result = financingBreakdown(300000000n, 294000000n)
  assert.equal(result.paidToCarrier, 294000000n)
  assert.equal(result.paidToCarrier + result.pool + result.treasury, 300000000n)
})
test("pool earn percent follows the fee constants", () => {
  const expected = ((BPS - ADVANCE_BPS) / BPS) * ((BPS - PROTOCOL_SHARE_BPS) / BPS) * 100
  assert.ok(Math.abs(poolEarnPercent() - expected) < 1e-9)
})
