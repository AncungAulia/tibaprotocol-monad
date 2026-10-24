import { beforeEach, describe, expect, it, vi } from "vitest"
import { encodeAbiParameters, encodeEventTopics } from "viem"
import { tibaPoolAbi } from "@tiba/sc"

const POOL = "0x9999999999999999999999999999999999999999"
const INVESTOR = "0x1111111111111111111111111111111111111111" as const
const OTHER = "0x2222222222222222222222222222222222222222" as const
const HASH = `0x${"ab".repeat(32)}` as const

const m = vi.hoisted(() => ({
  role: vi.fn(),
  receipt: vi.fn(),
  rows: [] as unknown[],
  upsert: vi.fn(),
}))
vi.mock("@tiba/sc", async (original) => ({
  ...(await original<typeof import("@tiba/sc")>()),
  addresses: { tibaPool: "0x9999999999999999999999999999999999999999" },
}))
vi.mock("../../lib/chain.js", () => ({
  publicClient: { getTransactionReceipt: m.receipt },
  sameAddress: (a?: string | null, b?: string | null) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase(),
}))
vi.mock("../profile/profile.service.js", () => ({ requireRole: m.role }))
vi.mock("../../lib/supabase.js", () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    overrideTypes: async () => ({ data: m.rows, error: null }),
    upsert: async (rows: unknown) => {
      m.upsert(rows)
      return { data: null, error: null }
    },
  }
  return {
    supabase: { from: () => query },
    unwrap: (result: { data: unknown }) => result.data,
  }
})

const { poolHistory, recordPoolTransaction } = await import("./pool.service.js")

function depositLog(investor: `0x${string}`, assets: bigint, logIndex = 0) {
  return {
    address: POOL,
    topics: encodeEventTopics({ abi: tibaPoolAbi, eventName: "Deposited", args: { investor } }),
    data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [assets, assets]),
    logIndex,
    blockNumber: 500n,
    transactionHash: HASH,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.rows = []
  m.role.mockResolvedValue({ role: "investor" })
})

describe("investor history", () => {
  it("serves stored events in the app's shape", async () => {
    m.rows = [{ tx_hash: HASH, log_index: 1, investor: INVESTOR, kind: "withdraw", assets: "20", block: 9 }]
    expect(await poolHistory(INVESTOR)).toEqual([
      { kind: "withdraw", amount: "20", hash: HASH, block: "9", index: 1 },
    ])
  })

  it("records only this investor's pool events from a successful receipt", async () => {
    m.receipt.mockResolvedValue({
      status: "success",
      blockNumber: 500n,
      logs: [depositLog(INVESTOR, 100n, 3), depositLog(OTHER, 7n, 4)],
    })
    await recordPoolTransaction(INVESTOR, HASH)
    expect(m.upsert).toHaveBeenCalledWith([
      { tx_hash: HASH, log_index: 3, investor: INVESTOR, kind: "deposit", assets: "100", block: 500 },
    ])
  })

  it("refuses a transaction that is not the caller's deposit or withdrawal", async () => {
    m.receipt.mockResolvedValue({ status: "success", blockNumber: 1n, logs: [depositLog(OTHER, 7n)] })
    await expect(recordPoolTransaction(INVESTOR, HASH)).rejects.toMatchObject({ status: 400 })
    m.receipt.mockResolvedValue({ status: "reverted", blockNumber: 1n, logs: [] })
    await expect(recordPoolTransaction(INVESTOR, HASH)).rejects.toMatchObject({ status: 400 })
    expect(m.upsert).not.toHaveBeenCalled()
  })

  it("checks investor access first", async () => {
    m.role.mockRejectedValue(new Error("not investor"))
    await expect(poolHistory(INVESTOR)).rejects.toThrow("not investor")
    await expect(recordPoolTransaction(INVESTOR, HASH)).rejects.toThrow("not investor")
    expect(m.receipt).not.toHaveBeenCalled()
  })
})
