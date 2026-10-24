import { addresses, tibaPoolAbi } from "@tiba/sc"
import { TransactionReceiptNotFoundError, parseEventLogs, type Address, type Hash } from "viem"
import { publicClient, sameAddress } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import { requireRole } from "../profile/profile.service.js"

type HistoryItem = {
  kind: "deposit" | "withdraw"
  amount: string
  hash: string
  block: string
  index: number
}
type PoolEventRow = {
  tx_hash: string
  log_index: number
  investor: string
  kind: HistoryItem["kind"]
  assets: string
  block: number
}

/**
 * The investor's deposits and withdrawals, newest first. Read from pool_events, which holds
 * verified receipts: the public Monad RPC limits eth_getLogs to 100 blocks, so scanning is not an option.
 */
export async function poolHistory(address: Address): Promise<HistoryItem[]> {
  await requireRole(address, "investor")
  const rows = unwrap(
    await supabase
      .from("pool_events")
      .select("*")
      .eq("investor", address)
      .order("block", { ascending: false })
      .order("log_index", { ascending: false })
      .limit(500)
      .overrideTypes<PoolEventRow[], { merge: false }>(),
    "poolHistory",
  )
  return rows.map((row) => ({
    kind: row.kind,
    amount: String(row.assets),
    hash: row.tx_hash,
    block: String(row.block),
    index: row.log_index,
  }))
}

/**
 * Records a deposit or withdrawal after the app sees it confirmed. Reads the receipt itself and
 * keeps only Deposited/Withdrawn events from TibaPool for this investor, so nothing can be invented.
 */
export async function recordPoolTransaction(address: Address, hash: Hash) {
  await requireRole(address, "investor")
  let receipt
  try {
    receipt = await publicClient.getTransactionReceipt({ hash })
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError)
      throw HttpError.badRequest("This transaction is not confirmed yet.")
    throw HttpError.upstream("We could not check this transaction. Please try again.")
  }
  if (receipt.status !== "success") throw HttpError.badRequest("This transaction did not complete.")

  const events = parseEventLogs({
    abi: tibaPoolAbi,
    logs: receipt.logs.filter((log) => sameAddress(log.address, addresses.tibaPool)),
    eventName: ["Deposited", "Withdrawn"],
  }).filter((event) => sameAddress(event.args.investor, address))
  if (!events.length) throw HttpError.badRequest("This transaction is not a deposit or withdrawal of yours.")

  const rows = events.map((event) => ({
    tx_hash: hash.toLowerCase(),
    log_index: event.logIndex,
    investor: address,
    kind: event.eventName === "Deposited" ? ("deposit" as const) : ("withdraw" as const),
    assets: event.args.assets.toString(),
    block: Number(receipt.blockNumber),
  }))
  unwrap(
    await supabase
      .from("pool_events")
      .upsert(rows, { onConflict: "tx_hash,log_index", ignoreDuplicates: true }),
    "recordPoolTransaction",
  )
  return poolHistory(address)
}
