import { ADVANCE_BPS, BPS, PROTOCOL_SHARE_BPS } from "@tiba/sc"

const advanceBps = BigInt(ADVANCE_BPS)
const protocolShareBps = BigInt(PROTOCOL_SHARE_BPS)
const bps = BigInt(BPS)

export function sharesForWithdrawal(amount: bigint, totalAssets: bigint, totalShares: bigint) {
  if (amount <= 0n || totalAssets <= 0n || totalShares <= 0n) return 0n
  return (amount * (totalShares + 1n)) / (totalAssets + 1n)
}
/**
 * How a financed shipment's money is shared: the carrier got `advanced` (ADVANCE_BPS of the fee
 * when not financed yet), the payer repays `amount`, and the spread goes to the pool and the
 * treasury (PROTOCOL_SHARE_BPS of the spread). Mirrors the TibaPool integer arithmetic.
 */
export function financingBreakdown(amount: bigint, advanced?: bigint) {
  const paidToCarrier = advanced && advanced > 0n ? advanced : (amount * advanceBps) / bps
  const difference = amount - paidToCarrier
  const treasury = (difference * protocolShareBps) / bps
  return { paidToCarrier, pool: difference - treasury, treasury }
}

/** Share of each bill the pool earns, in percent (for copy like "1.6% of each bill"). */
export function poolEarnPercent() {
  return ((BPS - ADVANCE_BPS) * (BPS - PROTOCOL_SHARE_BPS)) / BPS / 100
}

/** "1.6" style label for the pool's share of each bill. */
export function poolEarnLabel() {
  return `${Number(poolEarnPercent().toFixed(2))}%`
}
