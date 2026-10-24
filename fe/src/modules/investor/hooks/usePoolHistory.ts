"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/providers/AuthProvider"
import { api } from "@/lib/api"

type HistoryItem = {
  kind: "deposit" | "withdraw"
  amount: string
  hash: string
  block: string
  index: number
}
export function usePoolHistory() {
  const { address, authenticated, getAccessToken } = useAuth()
  return useQuery({
    queryKey: ["pool-history", address],
    enabled: authenticated && !!address,
    retry: false,
    queryFn: async () => {
      // The backend returns the complete confirmed history for the selected investor.
      const rows = await api<HistoryItem[]>("/api/pool/history", {
        token: await getAccessToken(),
        walletAddress: address,
      })
      if (!Array.isArray(rows))
        throw new Error("Your payment history could not be read. Please try again.")
      return rows.map((row) => {
        if (
          !row ||
          !["deposit", "withdraw"].includes(row.kind) ||
          typeof row.amount !== "string" ||
          !/^\d+$/.test(row.amount) ||
          typeof row.block !== "string" ||
          !/^\d+$/.test(row.block) ||
          typeof row.hash !== "string" ||
          !/^0x[\da-f]{64}$/i.test(row.hash) ||
          !Number.isSafeInteger(row.index) ||
          row.index < 0
        )
          throw new Error("Your payment history could not be read. Please try again.")
        return { ...row, amount: BigInt(row.amount), block: BigInt(row.block) }
      })
    },
  })
}
