import { test } from "node:test"
import assert from "node:assert/strict"
import { fetchProfile } from "../src/lib/profile"
import { api, ApiError } from "../src/lib/api"

const wallet = "0x1111111111111111111111111111111111111111"
const other = "0x2222222222222222222222222222222222222222"

test("profile lookup sends the selected wallet and unwraps the backend profile for every role", async (context) => {
  let role = "payer"
  context.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.ok(url.endsWith("/api/profile/me"))
    const headers = new Headers(init.headers)
    assert.equal(headers.get("Authorization"), "Bearer access-token")
    assert.equal(headers.get("X-Wallet-Address"), wallet)
    return Response.json({
      address: wallet,
      profile: { address: wallet, role, name: null },
      company: null,
    })
  })
  for (role of ["payer", "carrier", "investor", "warehouse"]) {
    const profile = await fetchProfile(wallet, "access-token")
    assert.equal(profile?.role, role)
    assert.equal(profile?.name, null)
    assert.equal(profile?.address, wallet)
  }
})

test("a new wallet's successful null profile opens role selection", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ address: wallet, profile: null, company: null }),
  )
  assert.equal(await fetchProfile(wallet, "access-token"), null)
})

test("malformed profiles and a response for a different wallet are rejected before routing", async (context) => {
  const responses = [
    {},
    { address: wallet },
    { address: other, profile: null },
    { address: wallet, profile: { address: other, role: "payer", name: "Company" } },
    { address: wallet, profile: { address: wallet, role: "admin", name: "Company" } },
    { address: wallet, profile: { address: wallet, role: "__proto__", name: "Company" } },
  ]
  let response: unknown
  context.mock.method(globalThis, "fetch", async () => Response.json(response))
  for (response of responses)
    await assert.rejects(fetchProfile(wallet, "access-token"), /account|profile/i)
})

test("expired sessions and unexpected 404s remain errors rather than new accounts", async (context) => {
  let status = 401
  context.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: { code: "unauthorized", message: "Please sign in again." } },
      { status },
    ),
  )
  for (status of [401, 403, 404, 500]) {
    await assert.rejects(
      fetchProfile(wallet, "access-token"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === status &&
        error.message === "Please sign in again.",
    )
  }
})

test("a missing token cannot perform an anonymous profile lookup", async (context) => {
  const request = context.mock.method(globalThis, "fetch", async () => Response.json({}))
  await assert.rejects(fetchProfile(wallet, null), /sign in/i)
  assert.equal(request.mock.callCount(), 0)
})

test("the API client preserves Headers input and structured backend messages", async (context) => {
  context.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const headers = new Headers(init.headers)
    assert.equal(headers.get("X-Custom"), "test")
    assert.equal(headers.get("X-Wallet-Address"), wallet)
    return Response.json(
      { error: { code: "forbidden", message: "This wallet is not linked to your account." } },
      { status: 403 },
    )
  })
  await assert.rejects(
    api("/api/profile/me", {
      token: "access-token",
      walletAddress: wallet,
      headers: new Headers({ "X-Custom": "test" }),
    }),
    /not linked/,
  )
})
