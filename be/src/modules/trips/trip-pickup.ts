import { type Hash, TransactionReceiptNotFoundError } from "viem"
import { publicClient } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { hasPickupReceipt } from "../locations/location-simulation.js"

/** Read the actual receipt/block; never accept a client-supplied pickup timestamp. */
export async function verifiedPickupTime(shipmentId: number, hash: Hash): Promise<string> {
  let receipt
  try {
    receipt = await publicClient.getTransactionReceipt({ hash })
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError)
      throw HttpError.badRequest("The pickup transaction is not confirmed yet.")
    throw HttpError.upstream("We could not check the pickup receipt. Please try again.")
  }
  if (!hasPickupReceipt(receipt, shipmentId)) {
    throw HttpError.badRequest("This transaction does not confirm pickup for this shipment.")
  }
  try {
    const block = await publicClient.getBlock({ blockHash: receipt.blockHash })
    return new Date(Number(block.timestamp) * 1000).toISOString()
  } catch {
    throw HttpError.upstream("We could not read the pickup time. Please try again.")
  }
}
