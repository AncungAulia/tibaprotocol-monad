import { parseArgs } from "node:util"
import { setTimeout as delay } from "node:timers/promises"
import { createPublicClient, getAddress, http, type Hash } from "viem"
import { addresses, CHAIN_ID, shipmentManagerAbi } from "@tiba/sc"
import {
  hasPickupReceipt,
  runLocationSimulation,
  type SimulationTrip,
} from "../src/modules/locations/location-simulation.js"

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--")),
    options: {
      shipment: { type: "string" },
      "pickup-tx": { type: "string" },
      duration: { type: "string", default: "300" },
      interval: { type: "string", default: "30" },
      "api-url": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })
  if (values.help) {
    console.log(`Demo truck simulation (no blockchain transactions are sent).
Usage: pnpm --filter @tiba/be simulate:location --shipment 1 --pickup-tx 0x... [--duration 300] [--interval 30] [--dry-run]

Set DEMO_CARRIER_TOKEN to the carrier's Privy access token in be/.env.
Enable DEMO_LOCATION_SIMULATION=true on the API server and apply migration 0004.
--pickup-tx must be the successful PickedUp receipt for this shipment.
--duration is total simulated travel time in seconds from the actual pickup timestamp.
--dry-run prints one calculated sample without inserting a location.
Ctrl+C stops the process. Arrival is still confirmed by the warehouse.`)
    return
  }
  const shipmentId = Number(values.shipment)
  const durationSeconds = Number(values.duration)
  const intervalSeconds = Number(values.interval)
  if (
    !values.shipment ||
    !Number.isSafeInteger(shipmentId) ||
    shipmentId < 1 ||
    shipmentId > 33_554_431
  )
    throw new Error("Provide a valid --shipment ID.")
  if (!values["pickup-tx"] || !/^0x[\da-f]{64}$/i.test(values["pickup-tx"]))
    throw new Error("Provide the successful pickup transaction hash with --pickup-tx.")
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isFinite(intervalSeconds) ||
    intervalSeconds < 1 ||
    intervalSeconds > 60
  )
    throw new Error("Duration must be positive and interval must be between 1 and 60 seconds.")
  const token = process.env.DEMO_CARRIER_TOKEN
  if (!token)
    throw new Error(
      "Set DEMO_CARRIER_TOKEN to a short-lived Privy access token for this shipment's carrier.",
    )
  const base = new URL(
    values["api-url"] ?? process.env.DEMO_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  )
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  )
    throw new Error("API URL must be an HTTP(S) origin without credentials or a path.")
  const client = createPublicClient({
    transport: http(process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz", {
      timeout: 15000,
      retryCount: 1,
    }),
  })
  if ((await client.getChainId()) !== CHAIN_ID)
    throw new Error("The RPC must point to Monad testnet (10143).")
  const receipt = await client.getTransactionReceipt({ hash: values["pickup-tx"] as Hash })
  if (!hasPickupReceipt(receipt, shipmentId))
    throw new Error(
      "This receipt does not contain a successful PickedUp event for the selected shipment.",
    )
  const [block, shipment] = await Promise.all([
    client.getBlock({ blockHash: receipt.blockHash }),
    client.readContract({
      address: addresses.shipmentManager,
      abi: shipmentManagerAbi,
      functionName: "shipments",
      args: [BigInt(shipmentId)],
    }),
  ])
  const carrier = getAddress(shipment[1])
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(new URL(path, base), {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Wallet-Address": carrier,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
    const data = (await response.json()) as { error?: { message?: string } }
    if (!response.ok)
      throw new Error(`API ${response.status}: ${data.error?.message ?? "Request failed."}`)
    return data as T
  }
  try {
    console.log("Demo simulation: positions are simulated along the saved route, not device GPS.")
    const result = await runLocationSimulation(
      {
        shipmentId,
        pickedUpAt: Number(block.timestamp) * 1000,
        durationSeconds,
        intervalSeconds,
        dryRun: values["dry-run"],
        signal: controller.signal,
      },
      {
        loadTrip: () => api<SimulationTrip>(`/api/trips/${shipmentId}`),
        saveLocation: async (sample) => {
          await api("/api/locations", sample)
        },
        now: Date.now,
        wait: async (ms, signal) => {
          await delay(ms, undefined, { signal })
        },
        onSample: (sample, dryRun) => console.log(JSON.stringify({ ...sample, dryRun })),
      },
    )
    console.log(`Demo simulation stopped: ${result}.`)
  } catch (error) {
    if (controller.signal.aborted) console.log("Demo simulation cancelled.")
    else throw error
  } finally {
    process.off("SIGINT", stop)
    process.off("SIGTERM", stop)
  }
}

main().catch((error: unknown) => {
  // Do not print raw RPC errors, which can include credential-bearing URLs.
  const message = error instanceof Error ? error.message.split("\n")[0] : "Simulation failed."
  console.error(message)
  process.exitCode = 1
})
