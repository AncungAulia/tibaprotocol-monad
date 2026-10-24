import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  decodeErrorResult,
  type Hex,
} from "viem"
import { mockUsdcAbi, shipmentManagerAbi, tibaPoolAbi } from "@tiba/sc"
import { formatUsdcWithUnit } from "./format"

// Pool calls pull USDC, so a token error can surface from a pool transaction: decode against all three
const abi = [...shipmentManagerAbi, ...tibaPoolAbi, ...mockUsdcAbi]

function decoded(error: BaseError) {
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError) as
    | ContractFunctionRevertedError
    | null
  if (reverted?.data?.errorName) return reverted.data
  const raw = (reverted?.raw ??
    (error.walk((e) => typeof (e as { data?: unknown }).data === "string") as { data?: Hex } | null)
      ?.data) as Hex | undefined
  if (!raw) return undefined
  try {
    return decodeErrorResult({ abi, data: raw })
  } catch {
    return undefined
  }
}

/** Plain-language message for a failed simulation or wallet request, or undefined if not a chain error. */
export function chainErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined
  if (error.walk((e) => e instanceof UserRejectedRequestError))
    return "You cancelled this in your wallet. Nothing was sent."
  const result = decoded(error)
  const args = (result?.args ?? []) as readonly unknown[]
  const usdc = (value: unknown) => formatUsdcWithUnit(BigInt(value as bigint))
  switch (result?.errorName) {
    case "CreditLimitExceeded": {
      const [requested, outstanding, limit] = args as bigint[]
      return `That's ${usdc(requested + outstanding - limit)} over your limit.`
    }
    case "NotApprovedPayer":
      return "Your company is not approved for credit yet."
    case "PayerHasOverdue":
      return "You have an overdue bill. Pay it before creating a new shipment."
    case "InvalidDueDate":
      return "Choose a due date in the future."
    case "InvalidAmount":
    case "ZeroAmount":
      return "Enter an amount greater than zero."
    case "ZeroAddress":
      return "Choose a carrier and a destination first."
    case "NotCarrier":
      return "Only the carrier of this shipment can do this."
    case "NotConsignee":
      return "Only the receiving warehouse can confirm this delivery."
    case "InvalidStatus":
    case "NotDelivered":
    case "NotRepayable":
      return "This shipment has already changed. Refresh it before continuing."
    case "AlreadyFinanced":
      return "This trip has already been paid out."
    case "InsufficientLiquidity":
      return `The pool has ${usdc(args[1])} available right now, which is not enough for this payout. Please try again later.`
    case "InsufficientShares":
      return "That's more than you have in the pool."
    case "FaucetCooldown":
      return `You can get more test USDC at ${new Date(Number(args[0]) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
    case "ERC20InsufficientBalance":
      return "You don't have enough USDC for this."
    case "ERC20InsufficientAllowance":
      return "Allow this amount in your wallet first, then try again."
  }
  if (error.walk((e) => e instanceof ContractFunctionRevertedError))
    return "This transaction would fail, so it was not sent. Refresh and try again."
  if (/insufficient funds/i.test(error.message))
    return "Your wallet needs a little MON for the network fee."
  // Never show raw network text (addresses, call data) to people
  return "The network did not accept this. Please check your connection and try again."
}
