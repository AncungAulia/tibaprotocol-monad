"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState, type ReactNode } from "react"
import { Toaster } from "sonner"
import { WagmiProvider } from "wagmi"
import { wagmiConfig } from "@/lib/chain"
import { AuthContext, type Session } from "@/providers/AuthProvider"
import { publicApi, scenarios, type Scenario } from "./scenarios"

function seed(client: QueryClient, scenario: Scenario) {
  const { address } = scenario
  client.setQueryData(["profile", address], scenario.profile)
  if (scenario.shipments) client.setQueryData(["shipments", address], scenario.shipments)
  if (scenario.pool) {
    client.setQueryData(["pool", address, undefined], scenario.pool)
    client.setQueryData(["pool", address, address], scenario.pool)
  }
  if (scenario.poolHistory) client.setQueryData(["pool-history", address], scenario.poolHistory)
  for (const [path, data] of Object.entries(scenario.api ?? {}))
    client.setQueryData(["api", path, address], data)
  for (const [path, data] of Object.entries({ ...publicApi, ...scenario.publicApi }))
    client.setQueryData(["api", path, "public"], data)
}

/**
 * Dev-only stand-in for Privy + the API: a signed-in session for the chosen scenario and a
 * query cache filled with its sample data. Nothing refetches, so screens stay as seeded.
 */
export function PreviewProviders({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ client: QueryClient; session: Session } | null>(null)
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("s") ?? "payer"
    const scenario = scenarios[name] ?? scenarios.payer
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          refetchInterval: false,
          refetchOnWindowFocus: false,
          retry: false,
          // Anything not seeded stays loading instead of calling the real API
          queryFn: () => new Promise(() => {}),
        },
      },
    })
    seed(client, scenario)
    setState({
      client,
      session: {
        ready: true,
        authenticated: true,
        configured: true,
        connecting: false,
        address: scenario.address,
        login: () => {},
        logout: async () => {},
        getAccessToken: async () => "preview",
      },
    })
  }, [])
  if (!state) return null
  return (
    <QueryClientProvider client={state.client}>
      <WagmiProvider config={wagmiConfig}>
        <AuthContext.Provider value={state.session}>
          {children}
          <Toaster position="bottom-center" />
        </AuthContext.Provider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
