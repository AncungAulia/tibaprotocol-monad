import { PrivyClient, type User } from "@privy-io/node"
import { getAddress, isAddress, type Address } from "viem"
import { env } from "../config/env.js"

export const privy = new PrivyClient({
  appId: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
  ...(env.PRIVY_VERIFICATION_KEY ? { jwtVerificationKey: env.PRIVY_VERIFICATION_KEY } : {}),
})

export interface PrivyIdentity {
  privyId: string
  /** All Ethereum wallets linked to the Privy user, checksummed. External wallets first. */
  wallets: Address[]
  /** Wallets Privy created for an email login (subset of `wallets`). */
  embedded: Address[]
  email: string | null
}

const USER_CACHE_TTL_MS = 5 * 60 * 1000
const userCache = new Map<string, { value: PrivyIdentity; expiresAt: number }>()

/** Verifies a Privy access token and returns the Privy user id. Throws when invalid. */
export async function verifyAccessToken(token: string): Promise<string> {
  const claims = await privy.utils().auth().verifyAccessToken(token)
  return claims.user_id
}

/** Loads the user's linked wallets and email from Privy, cached for a few minutes. */
export async function getIdentity(privyId: string, options: { fresh?: boolean } = {}) {
  const cached = userCache.get(privyId)
  if (!options.fresh && cached && cached.expiresAt > Date.now()) return cached.value

  const user = await privy.users()._get(privyId)
  const value = toIdentity(user)
  userCache.set(privyId, { value, expiresAt: Date.now() + USER_CACHE_TTL_MS })
  return value
}

export function toIdentity(user: User): PrivyIdentity {
  const external: Address[] = []
  const embedded: Address[] = []
  let email: string | null = null

  for (const account of user.linked_accounts) {
    if (account.type === "email" && "address" in account && !email) {
      email = account.address
    }
    if (account.type !== "wallet" || !("chain_type" in account)) continue
    if (account.chain_type !== "ethereum" || !isAddress(account.address)) continue
    const address = getAddress(account.address)
    const isEmbedded = "connector_type" in account && account.connector_type === "embedded"
    ;(isEmbedded ? embedded : external).push(address)
  }

  return { privyId: user.id, wallets: [...external, ...embedded], embedded, email }
}
