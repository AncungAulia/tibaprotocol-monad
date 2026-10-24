import { test } from "node:test"
import assert from "node:assert/strict"
import { linkedWalletAddress, connectionError } from "../src/lib/wallet-session"

const wallet = "0xabcdef1111111111111111111111111111111111"
const other = "0x2222222222222222222222222222222222222222"

test("the account address follows only the active verified Ethereum wallet", () => {
  const accounts = [{ type: "wallet", chainType: "ethereum", address: wallet.toUpperCase() }]
  assert.equal(linkedWalletAddress(wallet, accounts), wallet)
  assert.equal(linkedWalletAddress(other, accounts), undefined)
  assert.equal(linkedWalletAddress(undefined, accounts), undefined)
  assert.equal(linkedWalletAddress(wallet, []), undefined)
  assert.equal(
    linkedWalletAddress(wallet, [{ type: "wallet", chainType: "solana", address: wallet }]),
    undefined,
  )
  assert.equal(linkedWalletAddress(wallet, [{ type: "email", address: wallet }]), undefined)
})

test("cancelled login and linking explain that the user can retry", () => {
  for (const code of ["exited_auth_flow", "exited_link_flow"]) {
    assert.match(connectionError(code), /cancelled.*try again/i)
  }
  assert.match(connectionError("unknown_connect_wallet_error"), /could not connect.*try again/i)
})
