import { test } from "node:test"
import assert from "node:assert/strict"
import { glide, pointAlong, simulationProgress } from "../src/lib/truck-position"

const road = [
  [110, -7],
  [110, -6.9],
  [110.3, -6.9],
]

test("demo progress runs from the verified pickup time and stops at the destination", () => {
  const simulation = { startedAt: "2026-10-24T05:00:00Z", durationSec: 180 }
  const start = Date.parse(simulation.startedAt)
  assert.equal(simulationProgress(simulation, start - 5000), 0)
  assert.equal(simulationProgress(simulation, start + 90_000), 0.5)
  assert.equal(simulationProgress(simulation, start + 999_000), 1)
  assert.equal(simulationProgress({ startedAt: "nope", durationSec: 180 }, start), 0)
})

test("the truck moves by road distance, around the bend", () => {
  assert.deepEqual(pointAlong(road, 0)?.position, [110, -7])
  assert.deepEqual(pointAlong(road, 1)?.position, [110.3, -6.9])
  // The second leg is about 3x longer than the first, so halfway is already past the bend
  const half = pointAlong(road, 0.5)!
  assert.ok(half.position[0] > 110 && half.position[1] === -6.9)
  assert.deepEqual(half.travelled.slice(0, 2), road.slice(0, 2))
  assert.equal(pointAlong([[110, -7]], 0.5), undefined)
})

test("a GPS fix glides in with ease-out and lands exactly on the new point", () => {
  const from: [number, number] = [110, -7],
    to: [number, number] = [110.1, -7]
  assert.deepEqual(glide(from, to, 0), from)
  assert.ok(glide(from, to, 500)[0] > 110.05)
  assert.deepEqual(glide(from, to, 1000), to)
  assert.deepEqual(glide(from, to, 5000), to)
})
