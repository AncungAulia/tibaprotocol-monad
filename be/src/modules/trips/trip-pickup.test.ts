import { beforeEach, describe, expect, it, vi } from "vitest"
import { encodeEventTopics, zeroHash, TransactionReceiptNotFoundError, type Hex } from "viem"
import { addresses, shipmentManagerAbi } from "@tiba/sc"
const m = vi.hoisted(() => ({ receipt: vi.fn(), block: vi.fn() }))
vi.mock("../../lib/chain.js", () => ({
  publicClient: { getTransactionReceipt: m.receipt, getBlock: m.block },
}))
const { verifiedPickupTime } = await import("./trip-pickup.js")
beforeEach(() => {
  vi.clearAllMocks()
  m.receipt.mockResolvedValue({
    status: "success",
    blockHash: zeroHash,
    logs: [
      {
        address: addresses.shipmentManager,
        data: "0x",
        removed: false,
        topics: encodeEventTopics({
          abi: shipmentManagerAbi,
          eventName: "PickedUp",
          args: { id: 1n },
        }) as [Hex, Hex],
      },
    ],
  })
  m.block.mockResolvedValue({ timestamp: 1000n })
})
describe("pickup receipt verification", () => {
  it("uses the receipt's block timestamp", async () => {
    expect(await verifiedPickupTime(1, zeroHash)).toBe("1970-01-01T00:16:40.000Z")
    expect(m.block).toHaveBeenCalledWith({ blockHash: zeroHash })
  })
  it("rejects a reverted receipt or the wrong shipment", async () => {
    await expect(verifiedPickupTime(2, zeroHash)).rejects.toMatchObject({ status: 400 })
    m.receipt.mockResolvedValue({ status: "reverted", logs: [] })
    await expect(verifiedPickupTime(1, zeroHash)).rejects.toMatchObject({ status: 400 })
    expect(m.block).not.toHaveBeenCalled()
  })
  it("maps an unconfirmed receipt to a clear client error", async () => {
    m.receipt.mockRejectedValue(new TransactionReceiptNotFoundError({ hash: zeroHash }))
    await expect(verifiedPickupTime(1, zeroHash)).rejects.toMatchObject({ status: 400 })
  })
  it("maps an RPC outage to an upstream error", async () => {
    m.receipt.mockRejectedValue(new Error("offline"))
    await expect(verifiedPickupTime(1, zeroHash)).rejects.toMatchObject({ status: 502 })
  })
})
