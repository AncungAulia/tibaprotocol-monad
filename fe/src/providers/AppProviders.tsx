"use client"

import { PrivyProvider } from "@privy-io/react-auth"
import { WagmiProvider } from "@privy-io/wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { Toaster } from "sonner"
import { monadTestnet, wagmiConfig } from "@/lib/chain"
import { env } from "@/lib/env"
import { WagmiProvider as BaseWagmiProvider } from "wagmi"
import { PrivySession } from "./AuthProvider"
import { PreviewProviders } from "@/dev/preview/PreviewProviders"

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  // Dev-only UI preview with sample data, no sign-in (scripts/ui-preview.mjs)
  if (process.env.NEXT_PUBLIC_UI_PREVIEW === "1") return <PreviewProviders>{children}</PreviewProviders>

  if (!env.privyAppId)
    return (
      <QueryClientProvider client={queryClient}>
        <BaseWagmiProvider config={wagmiConfig}>
          {children}
          <Toaster position="bottom-center" />
        </BaseWagmiProvider>
      </QueryClientProvider>
    )

  return (
    <PrivyProvider
      appId={env.privyAppId}
      config={{
        // every role can sign in either way: connect a wallet, or use an email code (Privy creates a wallet)
        loginMethods: ["wallet", "email"],
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        // Email wallets sign without a confirm pop-up, so warehouse staff just tap Confirm (PRD WH-3)
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
        appearance: { theme: "light", accentColor: "#111111" },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <PrivySession>{children}</PrivySession>
          <Toaster position="bottom-center" />
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
