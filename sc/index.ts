// Public entry of @tiba/sc. Consumed as TypeScript source by fe (transpilePackages) and be.
import deployment from "./deployments/10143.json" with { type: "json" }

export { mockUsdcAbi } from "./abi/mockUsdcAbi.ts"
export { shipmentManagerAbi } from "./abi/shipmentManagerAbi.ts"
export { tibaPoolAbi } from "./abi/tibaPoolAbi.ts"

export type Address = `0x${string}`

export const CHAIN_ID = 10143
export const USDC_DECIMALS = 6

/** Share of the fee advanced to the carrier (97.5%). Mirrors TibaPool.ADVANCE_BPS. */
export const ADVANCE_BPS = 9750
/** Share of the spread sent to the treasury (20%). Mirrors TibaPool.PROTOCOL_SHARE_BPS. */
export const PROTOCOL_SHARE_BPS = 2000
export const BPS = 10_000
/** Seconds after dueDate before a financed shipment counts as overdue. Mirrors TibaPool.GRACE. */
export const GRACE_SECONDS = 60

/**
 * Mirrors the Solidity `Status` enum. A const object (not a TS `enum`) so it also works under
 * Node's type stripping. Use `Status.REPAID` as a value and `Status` as the type.
 */
export const Status = {
  NONE: 0,
  APPROVED: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
  DISPUTED: 4,
  FINANCED: 5,
  REPAID: 6,
} as const
export type Status = (typeof Status)[keyof typeof Status]

/** Monad testnet deployment. Zero addresses until `pnpm --filter @tiba/sc deploy` has run. */
export const addresses: {
  mockUsdc: Address
  shipmentManager: Address
  tibaPool: Address
} = {
  mockUsdc: deployment.mockUsdc as Address,
  shipmentManager: deployment.shipmentManager as Address,
  tibaPool: deployment.tibaPool as Address,
}

export { deployment }
