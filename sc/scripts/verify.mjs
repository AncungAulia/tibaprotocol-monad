// Verifies the deployed contracts on all Monad explorers (MonadVision, Socialscan, Monadscan)
// through the verification API: https://agents.devnads.com/v1/verify
// Run after `pnpm deploy` from sc/: `node scripts/verify.mjs`
// Needs Foundry (forge, cast) on PATH. See docs/monad-notes.md.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const CHAIN_ID = 10143
const API = "https://agents.devnads.com/v1/verify"
const deployment = JSON.parse(readFileSync(`deployments/${CHAIN_ID}.json`, "utf8"))

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim()
}

function artifact(name) {
  return JSON.parse(readFileSync(`out/${name}.sol/${name}.json`, "utf8"))
}

// Constructor args for each ERC1967Proxy come from the Deploy broadcast (implementation, initialize calldata)
function proxyArgs(proxyAddress) {
  const file = `broadcast/Deploy.s.sol/${CHAIN_ID}/run-latest.json`
  if (!existsSync(file)) return null
  const run = JSON.parse(readFileSync(file, "utf8"))
  const tx = run.transactions.find(
    (t) => t.contractName === "ERC1967Proxy" && t.contractAddress?.toLowerCase() === proxyAddress.toLowerCase(),
  )
  if (!tx?.arguments) return null
  return sh("cast", ["abi-encode", "constructor(address,bytes)", ...tx.arguments]).replace(/^0x/, "")
}

async function verify(address, name, constructorArgs) {
  const meta = artifact(name).metadata
  const [path] = Object.entries(meta.settings.compilationTarget)[0]
  const contractName = `${path}:${name}`
  const standardJsonInput = JSON.parse(
    sh("forge", ["verify-contract", address, contractName, "--chain", String(CHAIN_ID), "--show-standard-json-input"]),
  )
  const body = {
    chainId: CHAIN_ID,
    contractAddress: address,
    contractName,
    compilerVersion: `v${meta.compiler.version}`,
    standardJsonInput,
    foundryMetadata: meta,
    ...(constructorArgs ? { constructorArgs } : {}),
  }
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  console.log(`${res.ok ? "ok  " : "FAIL"} ${name} ${address} ${res.status} ${await res.text()}`)
}

const targets = [
  [deployment.mockUsdc, "MockUSDC", sh("cast", ["abi-encode", "constructor(address)", deployment.owner]).replace(/^0x/, "")],
  [deployment.shipmentManagerImpl, "ShipmentManager"],
  [deployment.tibaPoolImpl, "TibaPool"],
  [deployment.shipmentManager, "ERC1967Proxy", proxyArgs(deployment.shipmentManager)],
  [deployment.tibaPool, "ERC1967Proxy", proxyArgs(deployment.tibaPool)],
]

for (const [address, name, args] of targets) {
  if (!address || /^0x0+$/.test(address)) {
    console.log(`skip ${name}: not deployed`)
    continue
  }
  if (name === "ERC1967Proxy" && !args) {
    console.log(`skip proxy ${address}: no broadcast file to read constructor args from`)
    continue
  }
  await verify(address, name, args)
}
