import { formatEther, parseEther, type Address, type Hash } from "viem"
import { env } from "../config/env.js"
import type { AuthUser } from "../types/express.js"
import { adminAccount, publicClient, withAdmin } from "./chain.js"
import { HttpError } from "./http-error.js"
import { logger } from "./logger.js"
import { supabase, unwrap } from "./supabase.js"

export type GasTopUpResult =
  | { status: "sent"; txHash: Hash; amount: string }
  | {
      status: "skipped"
      reason: "off" | "external_wallet" | "has_gas" | "already_sent" | "admin_low"
    }

/**
 * Sends a little MON to a wallet Privy created for an email login, so it can pay network fees.
 * Only email wallets qualify (people who connect their own wallet bring their own MON),
 * each address gets it once, and it stops before the admin wallet runs low.
 */
export async function topUpGas(user: AuthUser): Promise<GasTopUpResult> {
  const amount = parseEther(String(env.GAS_TOPUP_MON))
  if (amount === 0n || !adminAccount) return { status: "skipped", reason: "off" }

  const address = user.address
  if (!user.embedded.includes(address)) return { status: "skipped", reason: "external_wallet" }

  const balance = await publicClient.getBalance({ address })
  if (balance >= parseEther(String(env.GAS_TOPUP_BELOW_MON)))
    return { status: "skipped", reason: "has_gas" }

  // Claim the address first: the primary key makes a second request for the same wallet fail here
  const claim = await supabase.from("gas_topups").insert({ address, amount_wei: amount.toString() })
  if (claim.error?.code === "23505") return { status: "skipped", reason: "already_sent" }
  unwrap(claim, "claimGasTopUp")

  let broadcastAttempted = false
  try {
    const hash = await withAdmin(async (client) => {
      const adminBalance = await publicClient.getBalance({ address: adminAccount!.address })
      if (adminBalance - amount < parseEther(String(env.GAS_TOPUP_ADMIN_FLOOR_MON))) return null
      // Keep the claim if broadcast fails ambiguously. An operator can reconcile it safely.
      broadcastAttempted = true
      return client.sendTransaction({
        account: adminAccount!,
        chain: client.chain,
        to: address,
        value: amount,
      })
    })

    if (!hash) {
      logger.warn({ address }, "admin wallet is low on MON, gas top-up skipped")
      await release(address)
      return { status: "skipped", reason: "admin_low" }
    }

    unwrap(
      await supabase.from("gas_topups").update({ tx_hash: hash }).eq("address", address),
      "saveGasTopUp",
    )
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
    if (receipt.status !== "success") throw new Error(`gas top-up reverted in tx ${hash}`)
    return { status: "sent", txHash: hash, amount: formatEther(amount) }
  } catch (err) {
    logger.error({ err, address }, "gas top-up failed")
    if (!broadcastAttempted) await release(address)
    throw HttpError.upstream("We could not add network fee funds to your wallet. Please try again.")
  }
}

/** Frees the claim so the wallet can try again later. */
async function release(address: Address) {
  const { error } = await supabase
    .from("gas_topups")
    .delete()
    .eq("address", address)
    .is("tx_hash", null)
  if (error) logger.error({ err: error, address }, "could not release gas top-up claim")
}
