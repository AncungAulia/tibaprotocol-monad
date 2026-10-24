import { isAddress, type Address } from "viem"
import { addresses, mockUsdcAbi, shipmentManagerAbi, tibaPoolAbi } from "@tiba/sc"

function address(value: string | undefined): Address | undefined {
  return value && isAddress(value) && !/^0x0{40}$/i.test(value) ? (value as Address) : undefined
}
export const contracts = {
  usdc: {
    address: address(process.env.NEXT_PUBLIC_USDC_ADDRESS || addresses.mockUsdc),
    abi: mockUsdcAbi,
  },
  shipments: {
    address: address(process.env.NEXT_PUBLIC_SHIPMENT_MANAGER_ADDRESS || addresses.shipmentManager),
    abi: shipmentManagerAbi,
  },
  pool: {
    address: address(process.env.NEXT_PUBLIC_POOL_ADDRESS || addresses.tibaPool),
    abi: tibaPoolAbi,
  },
} as const
export const USDC_DECIMALS = 6
export enum Status {
  NONE,
  APPROVED,
  IN_TRANSIT,
  DELIVERED,
  DISPUTED,
  FINANCED,
  REPAID,
}
