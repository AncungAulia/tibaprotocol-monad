import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  send: vi.fn(),
  receipt: vi.fn(),
  balance: vi.fn(),
}))
vi.mock("./chain.js", () => ({
  adminAccount: { address: "0x9999999999999999999999999999999999999999" },
  publicClient: { getBalance: m.balance, waitForTransactionReceipt: m.receipt },
  withAdmin: (fn: (client: unknown) => unknown) => fn({ sendTransaction: m.send, chain: {} }),
}))
vi.mock("./supabase.js", () => ({
  supabase: {
    from: () => ({
      insert: m.insert,
      update: () => ({ eq: m.update }),
      delete: () => ({ eq: () => ({ is: m.remove }) }),
    }),
  },
  unwrap: (result: { error?: unknown; data?: unknown }) => {
    if (result.error) throw result.error
    return result.data
  },
}))
const { topUpGas } = await import("./gas.js")
const address = "0x1111111111111111111111111111111111111111"
const user = { address, embedded: [address] } as never
beforeEach(() => {
  vi.clearAllMocks()
  m.insert.mockResolvedValue({ error: null })
  m.update.mockResolvedValue({ error: null })
  m.remove.mockResolvedValue({ error: null })
  m.balance.mockResolvedValueOnce(0n).mockResolvedValue(100n * 10n ** 18n)
  m.send.mockResolvedValue("0xhash")
  m.receipt.mockResolvedValue({ status: "success" })
})
describe("gas top-up recovery", () => {
  it("retains a claim when receipt lookup times out after broadcast", async () => {
    m.receipt.mockRejectedValue(new Error("timeout"))
    await expect(topUpGas(user)).rejects.toMatchObject({ status: 502 })
    expect(m.update).toHaveBeenCalled()
    expect(m.remove).not.toHaveBeenCalled()
  })
  it("retains a claim even if persisting the broadcast hash fails", async () => {
    m.update.mockResolvedValue({ error: new Error("database offline") })
    await expect(topUpGas(user)).rejects.toMatchObject({ status: 502 })
    expect(m.remove).not.toHaveBeenCalled()
  })
  it("retains an ambiguous send failure instead of risking another payment", async () => {
    m.send.mockRejectedValue(new Error("connection lost during send"))
    await expect(topUpGas(user)).rejects.toMatchObject({ status: 502 })
    expect(m.remove).not.toHaveBeenCalled()
  })
  it("releases the claim only if no broadcast was attempted", async () => {
    m.balance.mockReset().mockResolvedValueOnce(0n).mockResolvedValueOnce(0n)
    expect(await topUpGas(user)).toEqual({ status: "skipped", reason: "admin_low" })
    expect(m.send).not.toHaveBeenCalled()
    expect(m.remove).toHaveBeenCalled()
  })
})
