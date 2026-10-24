// Read-only deployment/config checks. No transaction is signed or sent.
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createPublicClient, http, zeroAddress, type Hash } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { addresses, CHAIN_ID, shipmentManagerAbi, tibaPoolAbi, mockUsdcAbi } from "@tiba/sc"

for (const file of ["../.env", "../../fe/.env.local", "../../fe/.env"]) {
  const path = fileURLToPath(new URL(file, import.meta.url))
  if (existsSync(path)) process.loadEnvFile(path)
}
const client = createPublicClient({
  transport: http(process.env.MONAD_RPC_URL, { timeout: 15000, retryCount: 0 }),
})
let failed = false
function result(check: string, ok: boolean) {
  console.log(JSON.stringify({ check, ok }))
  if (!ok) failed = true
}
result("chain-id", (await client.getChainId()) === CHAIN_ID)
for (const [name, address] of Object.entries(addresses)) {
  const code = await client.getCode({ address })
  result(`deployed-${name}`, !!code && code !== "0x")
}
const pool = { address: addresses.tibaPool, abi: tibaPoolAbi }
const manager = { address: addresses.shipmentManager, abi: shipmentManagerAbi }
result(
  "manager-pool",
  (await client.readContract({ ...manager, functionName: "pool" })).toLowerCase() ===
    addresses.tibaPool.toLowerCase(),
)
result(
  "pool-manager",
  (await client.readContract({ ...pool, functionName: "manager" })).toLowerCase() ===
    addresses.shipmentManager.toLowerCase(),
)
result(
  "pool-usdc",
  (await client.readContract({ ...pool, functionName: "usdc" })).toLowerCase() ===
    addresses.mockUsdc.toLowerCase(),
)
result(
  "usdc-decimals",
  (await client.readContract({
    address: addresses.mockUsdc,
    abi: mockUsdcAbi,
    functionName: "decimals",
  })) === 6,
)
await Promise.all([
  client.readContract({ ...pool, functionName: "sharesOf", args: [zeroAddress] }),
  client.readContract({ ...pool, functionName: "payerStats", args: [zeroAddress] }),
  client.readContract({ ...pool, functionName: "balanceOfAssets", args: [zeroAddress] }),
  client.readContract({ ...manager, functionName: "nextId" }),
])
result("canonical-getters", true)
if (process.env.ADMIN_PRIVATE_KEY) {
  const admin = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as Hash)
  result(
    "admin-is-pool-owner",
    (await client.readContract({ ...pool, functionName: "owner" })).toLowerCase() ===
      admin.address.toLowerCase(),
  )
}
for (const [key, expected] of Object.entries({
  NEXT_PUBLIC_USDC_ADDRESS: addresses.mockUsdc,
  NEXT_PUBLIC_SHIPMENT_MANAGER_ADDRESS: addresses.shipmentManager,
  NEXT_PUBLIC_POOL_ADDRESS: addresses.tibaPool,
})) {
  if (!process.env[key]) {
    console.log(JSON.stringify({ check: `frontend-${key}`, skipped: "No frontend override configured" }))
    continue
  }
  result(
    `frontend-${key}`,
    process.env[key]!.toLowerCase() === expected.toLowerCase(),
  )
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  result(
    "supabase-project-alignment",
    process.env.SUPABASE_URL?.replace(/\/$/, "") ===
      process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ""),
  )
} else {
  console.log(JSON.stringify({ check: "supabase-project-alignment", skipped: "No frontend env configured" }))
}
if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
  result("privy-app-alignment", process.env.PRIVY_APP_ID === process.env.NEXT_PUBLIC_PRIVY_APP_ID)
} else {
  console.log(JSON.stringify({ check: "privy-app-alignment", skipped: "No frontend env configured" }))
}
process.exitCode = failed ? 1 : 0
