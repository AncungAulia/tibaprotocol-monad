import type { NextFunction, Request, Response } from "express"
import { getAddress, isAddress } from "viem"
import type { AuthUser } from "../types/express.js"
import { HttpError } from "../lib/http-error.js"
import { getIdentity, verifyAccessToken } from "../lib/privy.js"
import { logger } from "../lib/logger.js"

export const WALLET_HEADER = "x-wallet-address"

function readBearer(req: Request): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(" ")
  return scheme?.toLowerCase() === "bearer" && token ? token : null
}

/**
 * Verifies the Privy access token and resolves the wallet the request acts as.
 * Clients with more than one linked wallet send `X-Wallet-Address` to pick one.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req)
  if (!token) throw HttpError.unauthorized("Please sign in to continue.")

  let privyId: string
  try {
    privyId = await verifyAccessToken(token)
  } catch {
    throw HttpError.unauthorized("Your session has ended. Please sign in again.")
  }

  const requested = req.header(WALLET_HEADER)
  if (requested && !isAddress(requested)) {
    throw HttpError.badRequest("That wallet address does not look right.")
  }

  let identity
  try {
    identity = await getIdentity(privyId)
    // A wallet linked moments ago may not be in the cache yet.
    if (requested && !identity.wallets.some((w) => w === getAddress(requested))) {
      identity = await getIdentity(privyId, { fresh: true })
    }
  } catch (err) {
    logger.error({ err, privyId }, "failed to load Privy user")
    throw HttpError.upstream("We could not check your account right now. Please try again.")
  }

  const address = requested
    ? identity.wallets.find((w) => w === getAddress(requested))
    : identity.wallets[0]

  if (!address) {
    throw HttpError.forbidden(
      requested
        ? "This wallet is not linked to your account."
        : "Please connect a wallet to continue.",
    )
  }

  const user: AuthUser = { ...identity, address }
  req.user = user
  next()
}

/** Returns the signed-in user. Use only behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw HttpError.unauthorized()
  return req.user
}
