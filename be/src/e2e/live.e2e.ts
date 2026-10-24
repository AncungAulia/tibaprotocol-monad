/**
 * Live end-to-end check of be + Supabase + contracts on Monad testnet, with throwaway wallets.
 * Only Privy is stubbed: a bearer token "e2e:<address>:<email>" signs in as that wallet.
 *
 *   pnpm --filter @tiba/be e2e
 *
 * Needs be/.env with ADMIN_PRIVATE_KEY (funds the wallets, about 0.7 MON) and DEMO_AUTO_APPROVE=true.
 * Leaves its rows in Supabase, tagged with "E2E" names, like a real demo run would.
 */
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import {
  createWalletClient,
  getAddress,
  http,
  parseEther,
  type Abi,
  type Address,
  type Hash,
} from "viem"
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import { monadTestnet } from "viem/chains"
import { addresses, mockUsdcAbi, shipmentManagerAbi, tibaPoolAbi } from "@tiba/sc"

vi.mock("../lib/privy.js", () => ({
  verifyAccessToken: vi.fn(async (token: string) => {
    if (!token.startsWith("e2e:")) throw new Error("invalid token")
    return token
  }),
  getIdentity: vi.fn(async (privyId: string) => {
    const [, address, email] = privyId.split(":")
    return {
      privyId,
      wallets: [getAddress(address!)],
      embedded: [],
      email: email || null,
    }
  }),
}))

const { createApp } = await import("../app.js")
const { publicClient, withAdmin } = await import("../lib/chain.js")
const { env } = await import("../config/env.js")

const app = createApp()
const run = Date.now().toString(36)
const transport = http(env.MONAD_RPC_URL, { timeout: 30_000, retryCount: 3 })

type Party = { account: PrivateKeyAccount; address: Address; token: string; email: string }
function party(label: string): Party {
  const account = privateKeyToAccount(generatePrivateKey())
  const email = `e2e-${label}-${run}@example.com`
  return { account, address: account.address, token: `e2e:${account.address}:${email}`, email }
}
const payer = party("payer"),
  carrier = party("carrier"),
  warehouse = party("warehouse"),
  investor = party("investor")

const as = (who: Party) => ({ Authorization: `Bearer ${who.token}` })
const api = {
  get: (who: Party, path: string) => request(app).get(path).set(as(who)),
  post: (who: Party, path: string, body: object = {}) =>
    request(app).post(path).set(as(who)).send(body),
  patch: (who: Party, path: string, body: object) =>
    request(app).patch(path).set(as(who)).send(body),
}

/** Simulate, send with estimated gas + 10% (as fe does), and require a successful receipt. */
async function send(who: Party, address: Address, abi: Abi, functionName: string, args: unknown[] = []) {
  const call = { address, abi, functionName, args, account: who.account } as never
  await publicClient.simulateContract(call)
  const gas = await publicClient.estimateContractGas(call)
  const wallet = createWalletClient({ account: who.account, chain: monadTestnet, transport })
  const hash = await wallet.writeContract({ ...(call as object), gas: gas + gas / 10n } as never)
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 })
  expect(receipt.status, `${functionName} receipt`).toBe("success")
  return hash as Hash
}
const read = <T>(address: Address, abi: Abi, functionName: string, args: unknown[] = []) =>
  publicClient.readContract({ address, abi, functionName, args } as never) as Promise<T>

async function createShipment(fee: bigint) {
  const id = await read<bigint>(addresses.shipmentManager, shipmentManagerAbi, "nextId")
  const due = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400)
  await send(payer, addresses.shipmentManager, shipmentManagerAbi, "createShipment", [
    carrier.address,
    warehouse.address,
    fee,
    due,
  ])
  return Number(id)
}
const status = (id: number) =>
  read<number>(addresses.shipmentManager, shipmentManagerAbi, "statusOf", [BigInt(id)])
const usdc = (who: Party) => read<bigint>(addresses.mockUsdc, mockUsdcAbi, "balanceOf", [who.address])

const state: { pickup?: string; destination?: string; shipment?: number; disputed?: number } = {}

describe("live: be + Supabase + Monad testnet", () => {
  it("funds four throwaway wallets with MON for fees", async () => {
    for (const [who, mon] of [
      [payer, "0.25"],
      [carrier, "0.2"],
      [warehouse, "0.12"],
      [investor, "0.12"],
    ] as const) {
      // withAdmin spaces admin transactions 3 blocks apart (Monad reserve rule)
      const hash = await withAdmin((client) =>
        client.sendTransaction({
          account: client.account!,
          chain: client.chain,
          to: who.address,
          value: parseEther(mon),
        }),
      )
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe("success")
    }
  })

  it("ONB-3/4/5: payer signs up and gets an automatic 3,000 USDC credit limit on chain", async () => {
    const profile = await api.post(payer, "/api/profile", { role: "payer", name: `E2E Payer ${run}` })
    expect(profile.status, JSON.stringify(profile.body)).toBe(201)
    const submit = await api.post(payer, "/api/payer/submit", {
      companyName: `E2E Logistik ${run}`,
      registrationNo: "1234567890123",
      country: "Indonesia",
      province: "DI Yogyakarta",
      city: "Yogyakarta",
      street: "Jl. Malioboro 1",
      postalCode: "55271",
      contactName: "E2E Contact",
      phone: "+6281234567890",
      tripsPerMonth: 20,
      spendPerMonth: 5000,
    })
    expect(submit.status, JSON.stringify(submit.body)).toBe(201)
    const limit = await read<bigint>(addresses.tibaPool, tibaPoolAbi, "creditLimit", [payer.address])
    expect(limit).toBe(3_000_000_000n)
    const me = await api.get(payer, "/api/profile/me")
    expect(me.body.profile.role).toBe("payer")
    expect(me.body.company.review_status).toBe("approved")
  })

  it("ONB-6/8: carrier signs up and accepts the payer's invite", async () => {
    const profile = await api.post(carrier, "/api/profile", {
      role: "carrier",
      name: `E2E Driver ${run}`,
      phone: "+6281298765432",
      plate: "AB 1234 CD",
    })
    expect(profile.status, JSON.stringify(profile.body)).toBe(201)
    const invite = await api.post(payer, "/api/invites", { kind: "carrier" })
    expect(invite.status, JSON.stringify(invite.body)).toBe(201)
    const token = invite.body.invite.token as string
    const preview = await request(app).get(`/api/invites/${token}`)
    expect(preview.status).toBe(200)
    const accept = await api.post(carrier, `/api/invites/${token}/accept`)
    expect(accept.status, JSON.stringify(accept.body)).toBe(200)
    const again = await api.post(investor, `/api/invites/${token}/accept`)
    expect(again.status).toBeGreaterThanOrEqual(400)
    const pub = await request(app).get(`/api/profile/${carrier.address}`)
    expect(pub.body.plate).toBe("AB 1234 CD")
  })

  it("PAY-6/ONB-9: payer saves places, warehouse joins through its invite", async () => {
    const pickup = await api.post(payer, "/api/places", {
      name: `E2E Jogja depot ${run}`,
      address: "Jl. Magelang 10, Yogyakarta",
      lat: -7.7956,
      lng: 110.3695,
      kind: "pickup",
    })
    expect(pickup.status, JSON.stringify(pickup.body)).toBe(201)
    const destination = await api.post(payer, "/api/places", {
      name: `E2E Semarang hub ${run}`,
      address: "Jl. Kaligawe 9, Semarang",
      lat: -6.9667,
      lng: 110.4203,
      kind: "destination",
      receiverEmail: warehouse.email,
    })
    expect(destination.status, JSON.stringify(destination.body)).toBe(201)
    state.pickup = pickup.body.place.id
    state.destination = destination.body.place.id

    const invite = await api.post(payer, "/api/invites", {
      kind: "warehouse",
      placeId: state.destination,
      receiverEmail: warehouse.email,
    })
    expect(invite.status, JSON.stringify(invite.body)).toBe(201)
    const accept = await api.post(warehouse, `/api/invites/${invite.body.invite.token}/accept`, {
      name: "E2E Dewi",
    })
    expect(accept.status, JSON.stringify(accept.body)).toBe(200)
    const me = await api.get(warehouse, "/api/profile/me")
    expect(me.body.profile.role).toBe("warehouse")

    const network = await api.get(payer, "/api/network")
    expect(network.status).toBe(200)
    expect(JSON.stringify(network.body)).toContain(carrier.address)
  })

  it("SHR-2/3: faucet gives 1,000 USDC once per hour", async () => {
    for (const who of [payer, investor]) {
      await send(who, addresses.mockUsdc, mockUsdcAbi, "faucet")
      expect(await usdc(who)).toBe(1_000_000_000n)
    }
    await expect(
      publicClient.simulateContract({
        address: addresses.mockUsdc,
        abi: mockUsdcAbi,
        functionName: "faucet",
        account: payer.account,
      }),
    ).rejects.toThrow(/FaucetCooldown/)
  })

  it("PAY-3: over-limit shipment is refused; a 300 USDC shipment is created and its trip saved", async () => {
    await expect(
      publicClient.simulateContract({
        address: addresses.shipmentManager,
        abi: shipmentManagerAbi,
        functionName: "createShipment",
        args: [carrier.address, warehouse.address, 3_100_000_000n, BigInt(Math.floor(Date.now() / 1000) + 86400)],
        account: payer.account,
      }),
    ).rejects.toThrow(/CreditLimitExceeded/)

    state.shipment = await createShipment(300_000_000n)
    expect(await status(state.shipment)).toBe(1)
    const trip = await api.post(payer, "/api/trips", {
      shipmentId: state.shipment,
      pickupPlaceId: state.pickup,
      destinationPlaceId: state.destination,
      cargo: "120 boxes of coffee",
      quantity: 120,
    })
    expect(trip.status, JSON.stringify(trip.body)).toBe(201)
    expect(trip.body.trip.route_geojson).toBeTruthy()
    expect(trip.body.trip.quantity).toBe(120)
    const repeat = await api.post(payer, "/api/trips", {
      shipmentId: state.shipment,
      pickupPlaceId: state.pickup,
      destinationPlaceId: state.destination,
      cargo: "120 boxes of coffee",
    })
    expect(repeat.status).toBe(200)
  })

  it("CAR-2: only the carrier can pick up; pickup time is verified and starts the demo truck", async () => {
    const id = state.shipment!
    await expect(
      publicClient.simulateContract({
        address: addresses.shipmentManager,
        abi: shipmentManagerAbi,
        functionName: "confirmPickup",
        args: [BigInt(id)],
        account: payer.account,
      }),
    ).rejects.toThrow(/NotCarrier/)
    const pickupTx = await send(carrier, addresses.shipmentManager, shipmentManagerAbi, "confirmPickup", [BigInt(id)])
    expect(await status(id)).toBe(2)

    const forged = await api.patch(payer, `/api/trips/${id}`, { pickupTx })
    expect(forged.status).toBe(403)
    const saved = await api.patch(carrier, `/api/trips/${id}`, { pickupTx })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(saved.body.trip.picked_up_at).toBeTruthy()
    expect(saved.body.trip.channel_key).toBeUndefined()

    const forPayer = await api.get(payer, `/api/trips/${id}`)
    expect(forPayer.body.simulation?.durationSec).toBe(env.DEMO_TRIP_SECONDS)
    expect(forPayer.body.channel).toMatch(/^trip:[0-9a-f]{32}$/)
    expect(forPayer.body.pickup.name).toContain("Jogja")
  })

  it("CAR-3: carrier shares GPS; the 6-character code finds the shipment for the right warehouse only", async () => {
    const id = state.shipment!
    const gps = await api.post(carrier, "/api/locations", { shipmentId: id, lat: -7.5, lng: 110.3 })
    expect(gps.status, JSON.stringify(gps.body)).toBe(201)
    const stranger = await api.post(payer, "/api/locations", { shipmentId: id, lat: -7.5, lng: 110.3 })
    expect(stranger.status).toBe(403)

    const detail = await api.get(warehouse, `/api/trips/${id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.lastLocation?.lat).toBeCloseTo(-7.5)
    const code = detail.body.code as string
    expect(code).toMatch(/^[0-9A-Z]{6}$/)
    const mine = await api.get(warehouse, `/api/code/${code}`)
    expect(mine.body.forYou).toBe(true)
    expect(mine.body.trip.quantity).toBe(120)
    const notMine = await api.get(payer, `/api/code/${code}`)
    expect(notMine.body.forYou).toBe(false)
  })

  it("WH-3 + CAR-4/5: warehouse confirms, carrier gets 98% once", async () => {
    const id = state.shipment!
    await send(warehouse, addresses.shipmentManager, shipmentManagerAbi, "confirmDelivery", [BigInt(id), true, 120])
    expect(await status(id)).toBe(3)
    const late = await api.post(carrier, "/api/locations", { shipmentId: id, lat: -7, lng: 110.4 })
    expect(late.status).toBe(409)
    const arrived = await api.get(payer, `/api/trips/${id}`)
    expect(arrived.body.simulation).toBeNull()
    expect(arrived.body.channel).toBeNull()

    await send(carrier, addresses.tibaPool, tibaPoolAbi, "requestAdvance", [BigInt(id)])
    expect(await usdc(carrier)).toBe(294_000_000n)
    expect(await status(id)).toBe(5)
    await expect(
      publicClient.simulateContract({
        address: addresses.tibaPool,
        abi: tibaPoolAbi,
        functionName: "requestAdvance",
        args: [BigInt(id)],
        account: carrier.account,
      }),
    ).rejects.toThrow(/AlreadyFinanced|NotDelivered/)
  })

  it("PAY-5: payer repays 300 (allow + send); limit frees up and the record improves", async () => {
    const id = state.shipment!
    expect(await read<bigint>(addresses.tibaPool, tibaPoolAbi, "outstanding", [payer.address])).toBe(300_000_000n)
    const before = await read<bigint>(addresses.tibaPool, tibaPoolAbi, "available")
    await send(payer, addresses.mockUsdc, mockUsdcAbi, "approve", [addresses.tibaPool, 300_000_000n])
    await send(payer, addresses.tibaPool, tibaPoolAbi, "repay", [BigInt(id)])
    expect(await status(id)).toBe(6)
    expect(await read<bigint>(addresses.tibaPool, tibaPoolAbi, "outstanding", [payer.address])).toBe(0n)
    expect(await read<bigint>(addresses.tibaPool, tibaPoolAbi, "available")).toBe(before + 294_000_000n + 4_800_000n)
    const stats = await read<{ repaidCount: number }>(addresses.tibaPool, tibaPoolAbi, "payerStats", [payer.address])
    expect(Number(stats.repaidCount)).toBe(1)
  })

  it("WH-4: a problem report holds the payout", async () => {
    const id = await createShipment(100_000_000n)
    state.disputed = id
    const trip = await api.post(payer, "/api/trips", {
      shipmentId: id,
      pickupPlaceId: state.pickup,
      destinationPlaceId: state.destination,
      cargo: "50 boxes of tea",
    })
    expect(trip.status, JSON.stringify(trip.body)).toBe(201)
    await send(carrier, addresses.shipmentManager, shipmentManagerAbi, "confirmPickup", [BigInt(id)])
    await send(warehouse, addresses.shipmentManager, shipmentManagerAbi, "confirmDelivery", [BigInt(id), false, 40])
    expect(await status(id)).toBe(4)
    const report = await api.post(warehouse, "/api/reports", {
      shipmentId: id,
      issues: ["damaged", "missing_items"],
      receivedQty: 40,
      note: "10 boxes crushed",
    })
    expect(report.status, JSON.stringify(report.body)).toBe(201)
    const read = await api.get(carrier, `/api/reports/${id}`)
    expect(read.body.report.received_qty).toBe(40)
    await expect(
      publicClient.simulateContract({
        address: addresses.tibaPool,
        abi: tibaPoolAbi,
        functionName: "requestAdvance",
        args: [BigInt(id)],
        account: carrier.account,
      }),
    ).rejects.toThrow(/NotDelivered/)
  })

  it("INV-1/2/5: investor deposits and sees it in their history", async () => {
    const profile = await api.post(investor, "/api/profile", { role: "investor", name: "E2E Rina" })
    expect(profile.status, JSON.stringify(profile.body)).toBe(201)
    await send(investor, addresses.mockUsdc, mockUsdcAbi, "approve", [addresses.tibaPool, 100_000_000n])
    const deposit = await send(investor, addresses.tibaPool, tibaPoolAbi, "deposit", [100_000_000n])
    const recorded = await api.post(investor, "/api/pool/history", { txHash: deposit })
    expect(recorded.status, JSON.stringify(recorded.body)).toBe(201)
    const forged = await api.post(payer, "/api/pool/history", { txHash: deposit })
    expect(forged.status).toBe(403)
    const value = await read<bigint>(addresses.tibaPool, tibaPoolAbi, "balanceOfAssets", [investor.address])
    expect(value).toBeGreaterThanOrEqual(99_999_000n)
    const history = await api.get(investor, "/api/pool/history")
    expect(history.status, JSON.stringify(history.body)).toBe(200)
    expect(JSON.stringify(history.body).toLowerCase()).toContain("deposit")
    const deliveries = await api.get(investor, `/api/trips/${state.shipment}`)
    expect(deliveries.status).toBe(200)
    expect(deliveries.body.channel).toBeNull()
    expect(deliveries.body.lastLocation).toBeNull()
  })

  it("lists: each role sees only its own trips", async () => {
    const ids = async (who: Party) =>
      ((await api.get(who, "/api/trips")).body.trips as { shipment_id: number }[]).map((t) => t.shipment_id)
    for (const who of [payer, carrier, warehouse]) {
      const list = await ids(who)
      expect(list).toContain(state.shipment)
      expect(list).toContain(state.disputed)
    }
    const stranger = party("stranger")
    const none = await api.get(stranger, "/api/trips")
    expect(none.status).toBe(403)
  })
})
