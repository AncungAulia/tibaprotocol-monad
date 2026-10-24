"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Address } from "viem"
import { api } from "@/lib/api"

type Account = { type: string; address?: string; walletClientType?: string }
type TopUp = { status: "sent" | "skipped"; reason?: string }

const asked = new Set<string>()

/**
 * Email wallets start with 0 MON. Once per wallet, ask be/ to send a little MON
 * so the person can pay network fees without visiting a faucet. Connected wallets are skipped.
 */
export function useGasTopUp(
  address: Address | undefined,
  accounts: readonly Account[],
  getAccessToken: () => Promise<string | null>,
) {
  const queries = useQueryClient()
  const embedded =
    !!address &&
    accounts.some(
      (account) =>
        account.type === "wallet" &&
        account.walletClientType === "privy" &&
        account.address?.toLowerCase() === address.toLowerCase(),
    )

  useEffect(() => {
    if (!embedded || !address || asked.has(address)) return
    asked.add(address)
    getAccessToken()
      .then((token) => api<TopUp>("/api/profile/gas", { method: "POST", token, walletAddress: address }))
      .then((result) => {
        if (result.status === "sent") return queries.invalidateQueries()
      })
      .catch(() => asked.delete(address))
  }, [embedded, address, getAccessToken, queries])
}
