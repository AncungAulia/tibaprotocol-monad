import type { PublicClient } from "viem"
import type { useWriteContract } from "wagmi"

type Write = ReturnType<typeof useWriteContract>["writeContractAsync"]
type Request = Parameters<Write>[0]

/**
 * Monad charges the full gas limit, and a wallet facing a call that will revert can pick a huge one.
 * So simulate first (a revert throws here with its reason, before the wallet opens), then send
 * with the estimated gas plus 10%.
 */
export async function sendContract(client: PublicClient, write: Write, request: Request) {
  const call = request as unknown as Parameters<PublicClient["simulateContract"]>[0]
  await client.simulateContract(call)
  const gas = await client.estimateContractGas(
    call as unknown as Parameters<PublicClient["estimateContractGas"]>[0],
  )
  return write({ ...request, gas: gas + gas / 10n } as Request)
}
