import { describe, expect, it, vi } from "vitest"
import { encodeEventTopics, zeroHash, type Hex, type TransactionReceipt } from "viem"
import { addresses, shipmentManagerAbi, Status } from "@tiba/sc"
import {
  hasPickupReceipt,
  simulationRoute,
  simulatedPosition,
  runLocationSimulation,
} from "./location-simulation.js"

const route = {
  type: "LineString",
  coordinates: [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
}
const detail = {
  shipment: { status: Status.IN_TRANSIT },
  trip: { route_geojson: route, share_location: true },
}
function setup() {
  let clock = 0
  return {
    loadTrip: vi.fn().mockResolvedValue(detail),
    saveLocation: vi.fn().mockResolvedValue(undefined),
    now: () => clock,
    wait: vi.fn(async (ms: number) => {
      clock += ms
    }),
    onSample: vi.fn(),
  }
}
const options = { shipmentId: 1, pickedUpAt: 0, durationSeconds: 60 }

describe("route simulation geometry", () => {
  it("follows the road bend rather than cutting across its endpoints", () => {
    const halfway = simulatedPosition(simulationRoute(route), 30, 60)
    expect(halfway.lng).toBeCloseTo(1, 8)
    expect(halfway.lat).toBeCloseTo(0, 8)
    expect(halfway.progress).toBe(0.5)
  })
  it("accepts a Feature wrapper, clamps time and reaches the exact final coordinate", () => {
    const line = simulationRoute({ type: "Feature", geometry: route, properties: {} })
    expect(simulatedPosition(line, -30, 60)).toEqual({ lat: 0, lng: 0, progress: 0 })
    expect(simulatedPosition(line, 100, 60)).toEqual({ lat: 1, lng: 1, progress: 1 })
  })
  it.each([
    null,
    { type: "LineString", coordinates: [[0, 0]] },
    {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0, 0],
      ],
    },
    {
      type: "LineString",
      coordinates: [
        [181, 0],
        [1, 1],
      ],
    },
    { type: "Polygon", coordinates: [] },
  ])("rejects missing, degenerate or invalid geometry %j", (value) => {
    expect(() => simulationRoute(value)).toThrow()
  })
  it("rejects invalid duration instead of sending NaN coordinates", () => {
    expect(() => simulatedPosition(simulationRoute(route), 10, 0)).toThrow()
    expect(() => simulatedPosition(simulationRoute(route), NaN, 60)).toThrow()
  })
})

describe("simulation lifecycle", () => {
  it("sends sequential labeled samples every 30 seconds and stops at the destination", async () => {
    const dependencies = setup()
    expect(await runLocationSimulation(options, dependencies)).toBe("route_complete")
    expect(dependencies.saveLocation).toHaveBeenCalledTimes(3)
    expect(dependencies.wait.mock.calls).toEqual([
      [30000, undefined],
      [30000, undefined],
    ])
    expect(dependencies.saveLocation).toHaveBeenLastCalledWith({
      shipmentId: 1,
      lat: 1,
      lng: 1,
      recordedAt: new Date(60000).toISOString(),
      source: "simulated",
    })
    expect(dependencies.loadTrip).toHaveBeenCalledTimes(3)
  })
  it("resumes using elapsed pickup time when restarted", async () => {
    const dependencies = setup()
    dependencies.now = () => 60000
    expect(await runLocationSimulation(options, dependencies)).toBe("route_complete")
    expect(dependencies.saveLocation).toHaveBeenCalledTimes(1)
    expect(dependencies.wait).not.toHaveBeenCalled()
  })
  it("dry run reports a sample without writing or waiting", async () => {
    const dependencies = setup()
    expect(await runLocationSimulation({ ...options, dryRun: true }, dependencies)).toBe("dry_run")
    expect(dependencies.onSample).toHaveBeenCalledWith(
      expect.objectContaining({ source: "simulated", progress: 0 }),
      true,
    )
    expect(dependencies.saveLocation).not.toHaveBeenCalled()
    expect(dependencies.wait).not.toHaveBeenCalled()
  })
  it("stops when a warehouse confirms delivery between ticks", async () => {
    const dependencies = setup()
    dependencies.loadTrip
      .mockResolvedValueOnce(detail)
      .mockResolvedValue({ ...detail, shipment: { status: Status.DELIVERED } })
    expect(await runLocationSimulation(options, dependencies)).toBe("not_in_transit")
    expect(dependencies.saveLocation).toHaveBeenCalledTimes(1)
  })
  it("does not send locations without sharing consent", async () => {
    const dependencies = setup()
    dependencies.loadTrip.mockResolvedValue({
      ...detail,
      trip: { ...detail.trip, share_location: false },
    })
    expect(await runLocationSimulation(options, dependencies)).toBe("sharing_disabled")
    expect(dependencies.saveLocation).not.toHaveBeenCalled()
  })
  it("does not invent a route for missing metadata", async () => {
    const dependencies = setup()
    dependencies.loadTrip.mockResolvedValue({ ...detail, trip: null })
    await expect(runLocationSimulation(options, dependencies)).rejects.toThrow(/metadata/)
    expect(dependencies.saveLocation).not.toHaveBeenCalled()
  })
  it("stops on API failure without leaving a background timer", async () => {
    const dependencies = setup()
    dependencies.saveLocation.mockRejectedValue(new Error("API 401: expired token"))
    await expect(runLocationSimulation(options, dependencies)).rejects.toThrow(/expired token/)
    expect(dependencies.wait).not.toHaveBeenCalled()
  })
  it("can be cancelled without any network calls", async () => {
    const dependencies = setup()
    const controller = new AbortController()
    controller.abort()
    expect(
      await runLocationSimulation({ ...options, signal: controller.signal }, dependencies),
    ).toBe("cancelled")
    expect(dependencies.loadTrip).not.toHaveBeenCalled()
  })
})

describe("pickup receipt identity", () => {
  const receipt: Pick<TransactionReceipt, "status" | "logs"> = {
    status: "success",
    logs: [
      {
        address: addresses.shipmentManager,
        data: "0x",
        topics: encodeEventTopics({
          abi: shipmentManagerAbi,
          eventName: "PickedUp",
          args: { id: 1n },
        }) as [Hex, Hex],
        blockHash: zeroHash,
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: zeroHash,
        transactionIndex: 0,
        removed: false,
      },
    ],
  }
  it("requires the right shipment, contract and a successful receipt", () => {
    expect(hasPickupReceipt(receipt, 1)).toBe(true)
    expect(hasPickupReceipt(receipt, 2)).toBe(false)
    expect(hasPickupReceipt({ ...receipt, status: "reverted" }, 1)).toBe(false)
    expect(
      hasPickupReceipt(
        {
          ...receipt,
          logs: [{ ...receipt.logs[0]!, address: "0x1111111111111111111111111111111111111111" }],
        },
        1,
      ),
    ).toBe(false)
  })
})
