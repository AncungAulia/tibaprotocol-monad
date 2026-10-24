"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePublicClient, useWriteContract, useChainId, useSwitchChain, useAccount } from "wagmi"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { api, ApiError } from "./api"
import { contracts, Status } from "./contracts"
import { monadTestnet } from "./chain"
import { canAct, errorMessage } from "./validation"
import type { Shipment } from "./types"
import { tripMetadata, type TripDetailResponse } from "./responses"
import { savePickupReceipt } from "./pickup"
import { sendContract } from "./send-contract"
import type { Address, Hash } from "viem"
import {
  paymentArgs,
  readPendingPayment,
  samePayment,
  type PaymentAction,
  type PaymentArgs,
  type PendingPayment,
} from "./transaction-recovery"

export function useShipments() {
  const client = usePublicClient()
  const { address, authenticated, getAccessToken } = useAuth()
  return useQuery({
    queryKey: ["shipments", address],
    enabled: authenticated && !!address,
    // A pickup on the carrier's phone shows up on the payer's map within this time
    refetchInterval: 15000,
    retry: false,
    queryFn: async () => {
      if (!client || !contracts.shipments.address)
        throw new Error("Shipment service is not configured yet.")
      const contract = { ...contracts.shipments, address: contracts.shipments.address }
      const token = await getAccessToken()
      // Only the shipments linked to this wallet (be filters by role), newest first
      let ids: bigint[]
      try {
        const { trips } = await api<{ trips: { shipment_id: number }[] }>("/api/trips", {
          token,
          walletAddress: address,
        })
        ids = trips.map((trip) => BigInt(trip.shipment_id))
      } catch (error) {
        // No role yet: nothing to list
        if (error instanceof ApiError && error.status === 403) return []
        throw error
      }
      const rows = await Promise.all(
        ids.map(async (id) => {
          const [chain, advanced, detail] = await Promise.all([
            client.readContract({ ...contract, functionName: "shipments", args: [id] }),
            contracts.pool.address
              ? client.readContract({
                  ...contracts.pool,
                  address: contracts.pool.address,
                  functionName: "advanced",
                  args: [id],
                })
              : Promise.resolve(0n),
            api<TripDetailResponse>(`/api/trips/${id}`, { token, walletAddress: address }).then(
              (data) => ({ trip: tripMetadata(data), metadataError: undefined }),
              (error: unknown) => ({
                trip: undefined,
                metadataError:
                  error instanceof ApiError && error.status === 404
                    ? undefined
                    : errorMessage(error),
              }),
            ),
          ])
          const [payer, carrier, consignee, amount, dueDate, deliveredAt, receivedQty, status] =
            chain
          if (status === Status.NONE) return null
          return {
            id: id.toString(),
            payer,
            carrier,
            consignee,
            amount,
            dueDate,
            deliveredAt,
            receivedQty,
            status,
            advanced,
            trip: detail.trip,
            metadataError: detail.metadataError,
          } satisfies Shipment
        }),
      )
      return rows.filter((row): row is NonNullable<typeof row> => row !== null)
    },
  })
}

export function usePoolAccount(payer?: Address) {
  const client = usePublicClient()
  const { address, authenticated } = useAuth()
  return useQuery({
    queryKey: ["pool", address, payer],
    enabled: authenticated && !!address,
    refetchInterval: 30000,
    retry: false,
    queryFn: async () => {
      if (!client || !address || !contracts.pool.address || !contracts.usdc.address)
        throw new Error("Payment service is not configured yet.")
      const pool = { ...contracts.pool, address: contracts.pool.address }
      const [
        creditLimit,
        outstanding,
        available,
        totalAssets,
        shares,
        totalShares,
        maxWithdraw,
        stats,
        balance,
        value,
      ] = await Promise.all([
        client.readContract({ ...pool, functionName: "creditLimit", args: [payer ?? address] }),
        client.readContract({ ...pool, functionName: "outstanding", args: [payer ?? address] }),
        client.readContract({ ...pool, functionName: "available" }),
        client.readContract({ ...pool, functionName: "totalAssets" }),
        client.readContract({ ...pool, functionName: "sharesOf", args: [address] }),
        client.readContract({ ...pool, functionName: "totalShares" }),
        client.readContract({ ...pool, functionName: "maxWithdraw", args: [address] }),
        client.readContract({ ...pool, functionName: "payerStats", args: [payer ?? address] }),
        client.readContract({
          ...contracts.usdc,
          address: contracts.usdc.address,
          functionName: "balanceOf",
          args: [address],
        }),
        client.readContract({ ...pool, functionName: "balanceOfAssets", args: [address] }),
      ])
      return {
        creditLimit,
        outstanding,
        available,
        totalAssets,
        shares,
        totalShares,
        maxWithdraw,
        repaidCount: stats.repaidCount,
        lateCount: stats.lateCount,
        totalRepaid: stats.totalRepaid,
        balance,
        value,
      }
    },
  })
}

const activePayments = new Set<string>()
export function useTransaction() {
  const client = usePublicClient()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { address, authenticated, getAccessToken } = useAuth()
  const account = useAccount()
  const queries = useQueryClient()
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState("")
  const [hash, setHash] = useState<Hash>()
  const [error, setError] = useState<string>()
  const [recovery, setRecovery] = useState<PendingPayment>()
  const storageKey = `tiba:payment:${monadTestnet.id}:${address?.toLowerCase()}`
  useEffect(() => {
    setHash(undefined)
    setError(undefined)
    setStep("")
    function update() {
      try {
        setRecovery(readPendingPayment(localStorage.getItem(storageKey)))
      } catch (cause) {
        setError(errorMessage(cause))
      }
    }
    update()
    window.addEventListener("tiba:payment", update)
    window.addEventListener("storage", update)
    return () => {
      window.removeEventListener("tiba:payment", update)
      window.removeEventListener("storage", update)
    }
  }, [storageKey])
  function clearRecovery() {
    localStorage.removeItem(storageKey)
    window.dispatchEvent(new Event("tiba:payment"))
  }
  function reset() {
    if (!inFlight.current) {
      setHash(undefined)
      setError(undefined)
      setStep("")
    }
  }
  async function run(action: PaymentAction, args: PaymentArgs = {}) {
    if (inFlight.current || activePayments.has(storageKey))
      throw new Error("Please wait for the current payment.")
    inFlight.current = true
    activePayments.add(storageKey)
    setPending(true)
    setError(undefined)
    setHash(undefined)
    try {
      if (!authenticated || !address || !client) throw new Error("Connect your wallet first.")
      if (account.address?.toLowerCase() !== address.toLowerCase())
        throw new Error("Please reconnect the wallet for this account.")
      async function savePickupTime(pickupTx: Hash) {
        if (action !== "pickup") return
        setStep("Saving pickup time")
        await savePickupReceipt(args.id!, pickupTx, await getAccessToken(), address!)
      }
      // The money already moved; history is a convenience, so a failure here must not look like a failed payment
      async function savePoolHistory(poolTx: Hash) {
        if (action !== "deposit" && action !== "withdraw") return
        await api("/api/pool/history", {
          method: "POST",
          token: await getAccessToken(),
          walletAddress: address!,
          body: { txHash: poolTx },
        }).catch(() => undefined)
      }
      const saved = readPendingPayment(localStorage.getItem(storageKey))
      if (saved) {
        if (!samePayment(saved, action, args))
          throw new Error(
            "Check your previous payment using the banner above before starting another one.",
          )
        setStep("Checking your previous payment")
        const receipt = await client.waitForTransactionReceipt({ hash: saved.hash })
        if (receipt.status !== "success") {
          clearRecovery()
          throw new Error("Your previous payment did not complete. You can try again.")
        }
        // Keep recovery until the API has saved the verified pickup clock.
        await savePickupTime(saved.hash)
        await savePoolHistory(saved.hash)
        clearRecovery()
        setHash(saved.hash)
        setStep("Confirmed")
        await queries.invalidateQueries()
        return receipt
      }
      // Check recovery storage before asking the wallet to send money.
      localStorage.setItem(`${storageKey}:check`, "1")
      localStorage.removeItem(`${storageKey}:check`)
      const pool = contracts.pool.address,
        manager = contracts.shipments.address,
        usdc = contracts.usdc.address
      const target =
        action === "faucet" ? usdc : action === "pickup" || action === "confirm" ? manager : pool
      if (!target) throw new Error("This service is not configured yet. Please contact the team.")
      if (["pickup", "confirm", "advance", "repay"].includes(action)) {
        if (!args.id || !/^\d+$/.test(args.id) || !manager)
          throw new Error("Choose a valid shipment.")
        const shipment = await client.readContract({
          ...contracts.shipments,
          address: manager,
          functionName: "shipments",
          args: [BigInt(args.id)],
        })
        if (!canAct(shipment[7], action as "pickup" | "confirm" | "advance" | "repay"))
          throw new Error("This shipment has already changed. Refresh it before continuing.")
        if (action === "repay" && args.amount !== shipment[3])
          throw new Error("The payment amount does not match this bill.")
      }
      if (chainId !== monadTestnet.id) {
        setStep("Switching network")
        await switchChainAsync({ chainId: monadTestnet.id })
      }
      async function wait(tx: Hash) {
        const receipt = await client!.waitForTransactionReceipt({ hash: tx })
        if (receipt.status !== "success")
          throw new Error("The payment did not complete. No success has been recorded.")
        return receipt
      }
      if (action === "repay" || action === "deposit") {
        if (!usdc || !pool || !args.amount || args.amount <= 0n)
          throw new Error("Enter a valid amount.")
        const allowance = await client.readContract({
          ...contracts.usdc,
          address: usdc,
          functionName: "allowance",
          args: [address, pool],
        })
        if (allowance < args.amount) {
          setStep("1 of 2: allow this amount in your wallet")
          await wait(
            await sendContract(client!, writeContractAsync, {
              account: address,
              ...contracts.usdc,
              address: usdc,
              functionName: "approve",
              args: [pool, args.amount],
              chainId: monadTestnet.id,
            }),
          )
        }
      }
      setStep(
        action === "repay" || action === "deposit"
          ? "2 of 2: confirm the payment in your wallet"
          : "Confirm in your wallet",
      )
      let tx: Hash
      const id = BigInt(args.id ?? "0")
      if (action === "pickup")
        tx = await sendContract(client!, writeContractAsync, {
          account: address,
          ...contracts.shipments,
          address: target,
          functionName: "confirmPickup",
          args: [id],
        })
      else if (action === "confirm")
        tx = await sendContract(client!, writeContractAsync, {
          account: address,
          ...contracts.shipments,
          address: target,
          functionName: "confirmDelivery",
          args: [id, args.accepted ?? true, args.quantity ?? 0],
        })
      else if (action === "advance" || action === "repay")
        tx = await sendContract(client!, writeContractAsync, {
          account: address,
          ...contracts.pool,
          address: target,
          functionName: action === "advance" ? "requestAdvance" : "repay",
          args: [id],
        })
      else if (action === "faucet")
        tx = await sendContract(client!, writeContractAsync, {
          account: address,
          ...contracts.usdc,
          address: target,
          functionName: "faucet",
        })
      else {
        if (!args.amount || args.amount <= 0n) throw new Error("Enter an amount greater than zero.")
        tx = await sendContract(client!, writeContractAsync, {
          account: address,
          ...contracts.pool,
          address: target,
          functionName: action,
          args: [args.amount],
        })
      }
      const record: PendingPayment = { hash: tx, action, args: paymentArgs(args) }
      localStorage.setItem(storageKey, JSON.stringify(record))
      window.dispatchEvent(new Event("tiba:payment"))
      setStep("Waiting for confirmation")
      const receipt = await client.waitForTransactionReceipt({ hash: tx })
      if (receipt.status !== "success") {
        clearRecovery()
        throw new Error("The payment did not complete. You can try again.")
      }
      await savePickupTime(tx)
      await savePoolHistory(tx)
      clearRecovery()
      setHash(tx)
      setStep("Confirmed")
      await queries.invalidateQueries()
      return receipt
    } catch (cause) {
      setError(errorMessage(cause))
      throw cause
    } finally {
      inFlight.current = false
      activePayments.delete(storageKey)
      setPending(false)
    }
  }
  return { run, pending, step, hash, error, reset, recovery }
}
