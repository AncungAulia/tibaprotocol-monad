import type { Address } from "viem"

export function linkedWalletAddress(
  address: Address | undefined,
  accounts: readonly { type: string; chainType?: string; address?: string }[],
): Address | undefined {
  return address &&
    accounts.some(
      (account) =>
        account.type === "wallet" &&
        account.chainType === "ethereum" &&
        account.address?.toLowerCase() === address.toLowerCase(),
    )
    ? address
    : undefined
}

export function connectionError(code: string) {
  return code === "exited_auth_flow" || code === "exited_link_flow"
    ? "Connection cancelled. You can try again when you are ready."
    : "We could not connect your wallet. Please try again."
}
