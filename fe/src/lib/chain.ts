import { fallback, http } from "wagmi"
import { defineChain } from "viem"
import { monadTestnet as viemMonadTestnet } from "viem/chains"
import { createConfig } from "@privy-io/wagmi"
import { env } from "./env"

// Public RPCs, tried after the configured one. The default testnet RPC allows 15 requests/s per IP.
const BACKUP_RPCS = ["https://rpc-testnet.monadinfra.com", "https://testnet-rpc.monad.xyz"]
const rpcUrls = [...new Set([env.rpcUrl, ...BACKUP_RPCS])]

// viem's chain hardcodes testnet-rpc.monad.xyz, and Privy's embedded wallet sends through the
// chain's own RPC, so the configured RPC has to live on the chain object, not only on wagmi.
export const monadTestnet = defineChain({
  ...viemMonadTestnet,
  rpcUrls: { default: { http: rpcUrls } },
})

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: fallback(rpcUrls.map((url) => http(url, { batch: true, retryCount: 2 }))),
  },
  batch: { multicall: true },
})

export function receiptUrl(txHash: string) {
  return `${env.explorerUrl}/tx/${txHash}`
}
