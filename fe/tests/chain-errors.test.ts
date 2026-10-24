import { test } from "node:test"
import assert from "node:assert/strict"
import { ContractFunctionRevertedError, UserRejectedRequestError, encodeErrorResult } from "viem"
import { shipmentManagerAbi, tibaPoolAbi } from "@tiba/sc"
import { chainErrorMessage } from "../src/lib/chain-errors"

function revert(abi: typeof shipmentManagerAbi | typeof tibaPoolAbi, errorName: string, args?: unknown[]) {
  const data = encodeErrorResult({ abi, errorName, args } as Parameters<typeof encodeErrorResult>[0])
  return new ContractFunctionRevertedError({ abi, data, functionName: "createShipment" })
}

test("a credit limit revert says how far over the limit, in USDC", () => {
  const error = revert(shipmentManagerAbi, "CreditLimitExceeded", [1_200_000_000n, 2_700_000_000n, 3_000_000_000n])
  assert.equal(chainErrorMessage(error), "That's 900.00 USDC over your limit.")
})

test("a thin pool explains what is available instead of a raw revert", () => {
  const error = revert(tibaPoolAbi, "InsufficientLiquidity", [294_000_000n, 100_000_000n])
  assert.match(chainErrorMessage(error)!, /100\.00 USDC available/)
})

test("cancelling in the wallet is not shown as a failure", () => {
  const error = new UserRejectedRequestError(new Error("User rejected the request."))
  assert.equal(chainErrorMessage(error), "You cancelled this in your wallet. Nothing was sent.")
})

test("ordinary errors are left to the caller", () => {
  assert.equal(chainErrorMessage(new Error("Choose a valid shipment.")), undefined)
})
