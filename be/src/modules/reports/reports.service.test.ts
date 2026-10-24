import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("../../lib/chain.js", () => ({
  Status: { DISPUTED: 4 },
  requireShipment: vi.fn(),
  sameAddress: (a?: string, b?: string) => a?.toLowerCase() === b?.toLowerCase(),
}))
const m = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock("../../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      upsert: (...args: unknown[]) => {
        m.save(...args)
        return { select: () => ({ single: async () => ({ data: { shipment_id: 1 } }) }) }
      },
    }),
  },
  unwrap: (result: { data: unknown }) => result.data,
}))
const { requireShipment } = await import("../../lib/chain.js")
const { createReport } = await import("./reports.service.js")
const warehouse = "0x1111111111111111111111111111111111111111"
const input = { shipmentId: 1, issues: ["damaged" as const], receivedQty: 2, note: "Damaged boxes" }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireShipment).mockResolvedValue({
    consignee: warehouse,
    status: 4,
    receivedQty: 2,
  } as never)
})
describe("report matches confirmed delivery", () => {
  it("rejects a report before the dispute is confirmed", async () => {
    vi.mocked(requireShipment).mockResolvedValue({ consignee: warehouse, status: 2 } as never)
    await expect(createReport(warehouse, input)).rejects.toMatchObject({ status: 409 })
    expect(m.save).not.toHaveBeenCalled()
  })
  it("rejects a quantity different from the on-chain receipt", async () => {
    await expect(createReport(warehouse, { ...input, receivedQty: 3 })).rejects.toMatchObject({
      status: 409,
    })
    expect(m.save).not.toHaveBeenCalled()
  })
  it("saves an idempotent report for the confirmed receiver", async () => {
    expect(await createReport(warehouse, input)).toEqual({ shipment_id: 1 })
    expect(m.save).toHaveBeenCalledWith(
      expect.objectContaining({ shipment_id: 1, received_qty: 2, reporter_address: warehouse }),
      { onConflict: "shipment_id" },
    )
  })
})
