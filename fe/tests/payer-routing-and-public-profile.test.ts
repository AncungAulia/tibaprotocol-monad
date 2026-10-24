import { test } from "node:test"
import assert from "node:assert/strict"
import { payerSetupStatus } from "../src/modules/onboarding/data/payer-status"
import { parsePublicProfile, profileLink } from "../src/modules/profile/data/public-profile"
import type { Company } from "../src/lib/types"

const company = (review_status: Company["review_status"]): Company => ({
  payer_address: "0x1111111111111111111111111111111111111111",
  company_name: "PT Maju",
  review_status,
  credit_limit: review_status === "approved" ? 3000 : null,
})
const base = { enabled: true, loading: false, missing: false, error: false }

test("payers only reach the dashboard once their company is approved", () => {
  assert.equal(payerSetupStatus({ ...base, enabled: false, company: undefined }), "idle")
  assert.equal(payerSetupStatus({ ...base, company: company("approved") }), "ready")
  assert.equal(payerSetupStatus({ ...base, company: company("in_review") }), "setup")
  assert.equal(payerSetupStatus({ ...base, company: company("needs_info") }), "setup")
  assert.equal(payerSetupStatus({ ...base, company: null }), "setup")
  assert.equal(
    payerSetupStatus({ ...base, missing: true, error: true, company: undefined }),
    "setup",
  )
  assert.equal(payerSetupStatus({ ...base, error: true, company: undefined }), "error")
})

test("a cached review state waits for a fresh check instead of bouncing the payer", () => {
  assert.equal(
    payerSetupStatus({ ...base, loading: true, company: company("in_review") }),
    "loading",
  )
  assert.equal(
    payerSetupStatus({ ...base, loading: true, missing: true, error: true, company: undefined }),
    "loading",
  )
  assert.equal(payerSetupStatus({ ...base, loading: true, company: company("approved") }), "ready")
})

test("public profiles are read defensively", () => {
  assert.equal(parsePublicProfile(null), null)
  assert.equal(parsePublicProfile({ address: "0xabc", role: "admin" }), null)
  assert.deepEqual(
    parsePublicProfile({
      address: "0xabc",
      role: "carrier",
      name: "Budi",
      plate: "AB 1234 CD",
      company: null,
    }),
    { address: "0xabc", role: "carrier", name: "Budi", plate: "AB 1234 CD", company: null },
  )
  assert.deepEqual(
    parsePublicProfile({
      address: "0xdef",
      role: "payer",
      name: "",
      plate: null,
      company: { name: "PT Maju", city: "Semarang", verified: true, creditLimit: 3000 },
    })?.company,
    { name: "PT Maju", city: "Semarang", verified: true, creditLimit: 3000 },
  )
  assert.equal(profileLink("https://tiba.app", "0xabc"), "https://tiba.app/u/0xabc")
})
