"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useLinkAccount, useLogin, usePrivy, useWallets } from "@privy-io/react-auth"
import { useAccount } from "wagmi"
import type { Address } from "viem"
import { toast } from "sonner"
import { linkedWalletAddress, connectionError } from "@/lib/wallet-session"
import { useGasTopUp } from "@/modules/wallet/hooks/useGasTopUp"

export type Session = {
  ready: boolean
  authenticated: boolean
  configured: boolean
  connecting: boolean
  error?: string
  address?: Address
  login: () => void
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}
export const AuthContext = createContext<Session>({
  ready: true,
  authenticated: false,
  configured: false,
  connecting: false,
  login: () => toast.error("Wallet connection is not configured yet. Please contact the team."),
  logout: async () => {},
  getAccessToken: async () => null,
})
export const useAuth = () => useContext(AuthContext)
export function PrivySession({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout, getAccessToken, user, isModalOpen } = usePrivy()
  const { ready: walletsReady } = useWallets()
  const { address: activeAddress } = useAccount()
  const [error, setError] = useState("")
  const onError = (code: string) => {
    const message = connectionError(code)
    setError(message)
    toast.error(message)
  }
  const { login: startLogin } = useLogin({ onError })
  const { linkWallet } = useLinkAccount({ onError })
  const address = authenticated
    ? linkedWalletAddress(activeAddress, user?.linkedAccounts ?? [])
    : undefined
  useGasTopUp(address, user?.linkedAccounts ?? [], getAccessToken)
  function login() {
    setError("")
    try {
      if (authenticated) linkWallet()
      else startLogin()
    } catch {
      onError("connection_failed")
    }
  }
  return (
    <AuthContext.Provider
      value={{
        ready: ready && (!authenticated || walletsReady),
        authenticated,
        configured: true,
        connecting: isModalOpen,
        error,
        address,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
