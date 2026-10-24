import { http } from "wagmi"
import { monadTestnet } from "viem/chains"
import { createConfig } from "@privy-io/wagmi"
import { env } from "./env"

export { monadTestnet }

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: { [monadTestnet.id]: http(env.rpcUrl) },
})

export function receiptUrl(txHash: string) {
  return `${env.explorerUrl}/tx/${txHash}`
}
