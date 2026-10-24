import { test } from "node:test"
import assert from "node:assert/strict"
import {
  inviteState,
  positiveInteger,
  safeProfileUrl,
} from "../src/modules/onboarding/data/validation"

test("invitations reject used, expired, and malformed expiry values", () => {
  const now = Date.parse("2026-10-23T10:00:00Z")
  assert.equal(inviteState({ expires_at: "2026-10-24T10:00:00Z" }, now), "active")
  assert.equal(inviteState({ expires_at: "2026-10-23T10:00:00Z" }, now), "expired")
  assert.equal(inviteState({ expires_at: "invalid" }, now), "expired")
  assert.equal(
    inviteState({ expires_at: "2026-10-24T10:00:00Z", used_by: "another account" }, now),
    "used",
  )
})

test("monthly trip counts must be positive whole safe integers", () => {
  for (const value of ["", "0", "-1", "1.5", "1e3", "9007199254740992"])
    assert.equal(positiveInteger(value), false)
  assert.equal(positiveInteger("40"), true)
})

test("carrier sharing only accepts an actual web link from the server", () => {
  assert.equal(safeProfileUrl(undefined), undefined)
  assert.equal(safeProfileUrl("javascript:alert(1)"), undefined)
  assert.equal(safeProfileUrl("/carrier/someone"), undefined)
  assert.equal(
    safeProfileUrl("https://app.tiba.example/carriers/123"),
    "https://app.tiba.example/carriers/123",
  )
})
