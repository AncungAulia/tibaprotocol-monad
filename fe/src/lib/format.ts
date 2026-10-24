import { formatUnits, parseUnits } from "viem"
import { USDC_DECIMALS } from "./contracts"

const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 294000000n -> "294.00" */
export function formatUsdc(raw: bigint): string {
  return usd.format(Number(formatUnits(raw, USDC_DECIMALS)))
}

/** 294000000n -> "294.00 USDC" */
export function formatUsdcWithUnit(raw: bigint): string {
  return `${formatUsdc(raw)} USDC`
}

/** "294.5" -> 294500000n */
export function parseUsdc(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value))
    throw new Error("Enter an amount with up to 6 decimal places.")
  return parseUnits(value, USDC_DECIMALS)
}

/** 0x1234...abcd -> "0x12...abcd" (only behind "View receipt" or the wallet menu) */
export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}
