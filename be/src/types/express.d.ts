import type { Address } from "viem"

export interface AuthUser {
  privyId: string
  /** The wallet this request acts as (checksummed). */
  address: Address
  /** Every Ethereum wallet linked to the Privy user. */
  wallets: Address[]
  /** Wallets Privy created for an email login (subset of `wallets`). */
  embedded: Address[]
  email: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}
