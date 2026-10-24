import { test } from "node:test"
import assert from "node:assert/strict"
import { travelledCoordinates } from "../src/lib/map-route"

test("travelled route follows road bends and stops at the nearest truck position", () => {
  const road = [
    [0, 0],
    [2, 0],
    [2, 4],
  ]
  assert.deepEqual(travelledCoordinates(road, [2.1, 2]), [
    [0, 0],
    [2, 0],
    [2, 2],
  ])
  assert.deepEqual(travelledCoordinates(road, [1, 0.1]), [
    [0, 0],
    [1, 0],
  ])
  assert.deepEqual(travelledCoordinates([], [1, 0]), [])
  assert.deepEqual(
    travelledCoordinates(
      [
        [0, 0],
        [0, 0],
      ],
      [1, 1],
    ),
    [
      [0, 0],
      [0, 0],
    ],
  )
})
