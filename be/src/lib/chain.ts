import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { monadTestnet } from "viem/chains"
import { Status, USDC_DECIMALS, addresses, shipmentManagerAbi, tibaPoolAbi } from "@tiba/sc"
import { env } from "../config/env.js"
import { HttpError } from "./http-error.js"
import { logger } from "./logger.js"

export { Status }

const transport = http(env.MONAD_RPC_URL, { timeout: 15_000, retryCount: 2 })

export const publicClient = createPublicClient({ chain: monadTestnet, transport })

export const adminAccount = env.ADMIN_PRIVATE_KEY
  ? privateKeyToAccount(env.ADMIN_PRIVATE_KEY as Hash)
  : undefined

export const adminClient = adminAccount
  ? createWalletClient({ account: adminAccount, chain: monadTestnet, transport })
  : undefined

let adminQueue: Promise<unknown> = Promise.resolve()

/** Blocks to wait after an admin transaction before the next one (Monad reserve balance rule). */
const ADMIN_SPACING_BLOCKS = 3n

/**
 * Below 10 MON, Monad reverts a MON transfer from an account that sent another transaction
 * in the last 3 blocks. So the next admin transaction waits until this one is mined and
 * 3 more blocks have passed.
 */
async function settle(result: unknown) {
  if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) return
  const receipt = await publicClient.waitForTransactionReceipt({ hash: result as Hash, timeout: 60_000 })
  while ((await publicClient.getBlockNumber({ cacheTime: 0 })) < receipt.blockNumber + ADMIN_SPACING_BLOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}

/**
 * Runs admin transactions one at a time, so two requests never pick the same nonce
 * and a MON top-up never lands right after another admin transaction.
 * `send` should return the transaction hash. Throws a 503 when the server has no admin key.
 */
export function withAdmin<T>(send: (client: NonNullable<typeof adminClient>) => Promise<T>): Promise<T> {
  if (!adminClient) {
    return Promise.reject(
      new HttpError(503, "admin_key_missing", "This is not set up on this server yet. Please try again later."),
    )
  }
  const client = adminClient
  const run = adminQueue.then(() => send(client))
  adminQueue = run.then(settle).catch(() => undefined)
  return run
}

/** Shipment as stored by ShipmentManager, with JSON-friendly fields. */
export interface ChainShipment {
  id: string
  payer: Address
  carrier: Address
  consignee: Address
  /** Fee in USDC base units (6 decimals), as a decimal string. */
  amount: string
  dueDate: number
  deliveredAt: number
  receivedQty: number
  status: number
}

type ShipmentTuple = readonly [Address, Address, Address, bigint, bigint, bigint, number, number]

/** Reads `shipments(id)` from ShipmentManager. Returns null when the shipment does not exist. */
export async function getShipment(id: bigint | number): Promise<ChainShipment | null> {
  if (addresses.shipmentManager === zeroAddress) {
    logger.error("ShipmentManager address is not set in @tiba/sc (contracts not deployed yet)")
    throw new HttpError(503, "not_deployed", "The network is not ready yet. Please try again later.")
  }

  let raw: ShipmentTuple
  try {
    raw = await publicClient.readContract({
      address: addresses.shipmentManager,
      abi: shipmentManagerAbi,
      functionName: "shipments",
      args: [BigInt(id)],
    })
  } catch (err) {
    logger.error({ err, shipmentId: String(id) }, "failed to read shipment from chain")
    throw HttpError.upstream("We could not check this shipment on the network. Please try again.")
  }

  const [payer, carrier, consignee, amount, dueDate, deliveredAt, receivedQty, status] = raw
  if (Number(status) === Status.NONE || payer === zeroAddress) return null

  return {
    id: String(id),
    payer: getAddress(payer),
    carrier: getAddress(carrier),
    consignee: getAddress(consignee),
    amount: amount.toString(),
    dueDate: Number(dueDate),
    deliveredAt: Number(deliveredAt),
    receivedQty: Number(receivedQty),
    status: Number(status),
  }
}

/** Same as getShipment but throws a 404 when missing. */
export async function requireShipment(id: bigint | number): Promise<ChainShipment> {
  const shipment = await getShipment(id)
  if (!shipment) throw HttpError.notFound("We could not find this shipment.")
  return shipment
}

/** Converts a whole-USDC amount (e.g. 3000) to base units. */
export function usdcToUnits(amount: number): bigint {
  return parseUnits(String(amount), USDC_DECIMALS)
}

/**
 * Calls TibaPool.setCreditLimit with the admin key and waits for the receipt.
 * Testnet only: the server holds the pool owner key for the demo.
 */
export async function setCreditLimit(payer: Address, limitUsdc: number): Promise<Hash> {
  if (!adminClient || !adminAccount) {
    throw new HttpError(
      503,
      "admin_key_missing",
      "Automatic approval is not set up on this server yet. Please try again later.",
    )
  }

  const hash = await withAdmin((client) =>
    client.writeContract({
      address: addresses.tibaPool,
      abi: tibaPoolAbi,
      functionName: "setCreditLimit",
      args: [payer, usdcToUnits(limitUsdc)],
      account: adminAccount,
      chain: monadTestnet,
    }),
  )

  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 })
  if (receipt.status !== "success") {
    throw new Error(`setCreditLimit reverted in tx ${hash}`)
  }
  return hash
}

/** Payer's repayment record from TibaPool, or null when the network can't be reached. */
export async function getPayerStats(payer: Address) {
  try {
    const stats = await publicClient.readContract({
      address: addresses.tibaPool,
      abi: tibaPoolAbi,
      functionName: "payerStats",
      args: [payer],
    })
    return { repaidCount: Number(stats.repaidCount), lateCount: Number(stats.lateCount) }
  } catch (err) {
    logger.warn({ err }, "could not read payer stats")
    return null
  }
}

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}
