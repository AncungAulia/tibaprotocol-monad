import type { Address, Hash } from "viem"
import { api } from "./api"

/** Persist a confirmed receipt through the authenticated API; never send another chain transaction. */
export async function savePickupReceipt(
  id: string,
  pickupTx: Hash,
  token: string | null,
  walletAddress: Address,
) {
  return api(`/api/trips/${id}`, { method: "PATCH", token, walletAddress, body: { pickupTx } })
}
