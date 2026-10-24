"use client"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { NewShipmentContent } from "./NewShipmentContent"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi"
import { decodeEventLog, isAddress, parseUnits, type Hash } from "viem"
import { useAuth } from "@/providers/AuthProvider"
import { usePlaces, useNetwork } from "@/lib/queries"
import { usePoolAccount, useShipments } from "@/lib/ledger"
import { api } from "@/lib/api"
import { tripRequest } from "@/lib/requests"
import { contracts } from "@/lib/contracts"
import { monadTestnet } from "@/lib/chain"
import { sendContract } from "@/lib/send-contract"
import { errorMessage } from "@/lib/validation"
import { Card, QueryState, TextLink } from "@/components/elements/DataState"
import { Button } from "@/components/elements/Button"
import { TransactionStatus } from "@/components/elements/TransactionStatus"
import { isOverdue, validateShipment } from "../data/shipment"
type Recovery = {
  hash: Hash
  owner: string
  payload: {
    shipment_id?: string
    pickup_place: string
    destination_place: string
    cargo: string
    quantity?: number
  }
}
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
export function NewShipmentScreen() {
  const auth = useAuth(),
    router = useRouter(),
    queries = useQueryClient()
  const places = usePlaces(),
    relations = useNetwork(),
    account = usePoolAccount(),
    shipments = useShipments()
  const wallet = useAccount(),
    client = usePublicClient(),
    chainId = useChainId(),
    { switchChainAsync } = useSwitchChain(),
    { writeContractAsync } = useWriteContract()
  const [carrier, setCarrier] = useState(""),
    [pickupId, setPickup] = useState(""),
    [destinationId, setDestination] = useState("")
  const [cargo, setCargo] = useState(""),
    [quantity, setQuantity] = useState(""),
    [fee, setFee] = useState(""),
    [due, setDue] = useState("")
  const [pending, setPending] = useState(false),
    [step, setStep] = useState(""),
    [error, setError] = useState<string>(),
    [recovery, setRecovery] = useState<Recovery>(),
    [recoveryReady, setRecoveryReady] = useState(false)
  const busy = useRef(false)
  const storageKey = `tiba:pending-shipment:${monadTestnet.id}:${auth.address?.toLowerCase()}`
  useEffect(() => {
    setRecoveryReady(false)
    setRecovery(undefined)
    try {
      const value = localStorage.getItem(storageKey)
      if (value) {
        const saved = JSON.parse(value)
        if (
          saved.owner === auth.address?.toLowerCase() &&
          /^0x[\da-f]{64}$/i.test(saved.hash) &&
          saved.payload?.cargo &&
          saved.payload?.pickup_place &&
          saved.payload?.destination_place
        )
          setRecovery(saved)
      }
    } catch {
      setError(
        "Could not restore an unfinished shipment. Check your shipments before approving another trip.",
      )
      return
    }
    setRecoveryReady(true)
  }, [storageKey, auth.address])
  const pickup = places.data?.find((p) => p.id === pickupId),
    destination = places.data?.find((p) => p.id === destinationId)
  const remaining =
    account.data && account.data.creditLimit > account.data.outstanding
      ? account.data.creditLimit - account.data.outstanding
      : 0n
  const overdue = (shipments.data ?? []).some(
    (s) => s.payer.toLowerCase() === auth.address?.toLowerCase() && isOverdue(s),
  )
  const validation = validateShipment(fee, due, remaining, overdue)
  const amount = /^\d+(\.\d{1,6})?$/.test(fee) ? parseUnits(fee, 6) : 0n
  const connected = (relations.data ?? []).filter(
    (r) => ["joined", "connected", "active"].includes(r.status) && isAddress(r.carrier_address),
  )
  // Box count lets the warehouse confirm "All 120 boxes arrived" with one tap
  const quantityError =
    quantity && !/^\d+$/.test(quantity)
      ? "Use a whole number."
      : quantity && (Number(quantity) < 1 || Number(quantity) > 1_000_000)
        ? "Enter between 1 and 1,000,000 items."
        : undefined
  const valid =
    !validation &&
    !quantityError &&
    !!cargo.trim() &&
    !!pickup &&
    !!destination?.receiver_address &&
    isAddress(destination.receiver_address) &&
    pickup.id !== destination.id &&
    connected.some((r) => r.carrier_address === carrier)
  function persist(value: Recovery) {
    setRecovery(value)
    localStorage.setItem(storageKey, JSON.stringify(value))
  }
  async function submit() {
    if (busy.current || !auth.address || !client) return
    busy.current = true
    setPending(true)
    setError(undefined)
    try {
      let saved = recovery
      if (saved && saved.owner !== auth.address.toLowerCase())
        throw new Error("Switch back to the wallet that created this shipment.")
      if (!saved) {
        if (!wallet.address || wallet.address.toLowerCase() !== auth.address.toLowerCase())
          throw new Error("Connect the wallet linked to your profile before approving a shipment.")
        if (!valid || !destination?.receiver_address || !isAddress(carrier))
          throw new Error("Complete every field before approving this shipment.")
        if (!contracts.shipments.address) throw new Error("Shipment service is not configured yet.")
        // Ensure recovery storage works before asking the wallet to approve a trip.
        localStorage.setItem(storageKey, "null")
        localStorage.removeItem(storageKey)
        if (chainId !== monadTestnet.id) {
          setStep("Switching network")
          await switchChainAsync({ chainId: monadTestnet.id })
        }
        setStep("Approve this shipment in your wallet")
        const hash = await sendContract(client!, writeContractAsync, {
          account: auth.address,
          ...contracts.shipments,
          address: contracts.shipments.address,
          functionName: "createShipment",
          args: [
            carrier,
            destination.receiver_address,
            amount,
            BigInt(Math.floor(Date.parse(`${due}T00:00:00`) / 1000)),
          ],
          chainId: monadTestnet.id,
        })
        saved = {
          hash,
          owner: auth.address.toLowerCase(),
          payload: {
            pickup_place: pickupId,
            destination_place: destinationId,
            cargo: cargo.trim(),
            quantity: quantity ? Number(quantity) : undefined,
          },
        }
        persist(saved)
      }
      if (!saved.payload.shipment_id) {
        setStep("Waiting for confirmation")
        const receipt = await client.waitForTransactionReceipt({ hash: saved.hash })
        if (receipt.status !== "success") {
          localStorage.removeItem(storageKey)
          setRecovery(undefined)
          throw new Error("Approval did not complete. You can try again.")
        }
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== contracts.shipments.address?.toLowerCase()) continue
          try {
            const event = decodeEventLog({
              abi: contracts.shipments.abi,
              eventName: "ShipmentCreated",
              data: log.data,
              topics: log.topics,
            })
            if (event.args.payer.toLowerCase() === saved.owner) {
              saved = {
                ...saved,
                payload: { ...saved.payload, shipment_id: event.args.id.toString() },
              }
              persist(saved)
              break
            }
          } catch {}
        }
        if (!saved.payload.shipment_id)
          throw new Error(
            "Approval confirmed, but the shipment reference could not be read. Contact the team with your receipt. Do not approve another trip.",
          )
      }
      setStep("Saving trip details")
      await api("/api/trips", {
        method: "POST",
        token: await auth.getAccessToken(),
        walletAddress: auth.address,
        body: tripRequest(saved.payload),
      })
      localStorage.removeItem(storageKey)
      setRecovery(undefined)
      await queries.invalidateQueries()
      router.push(`/payer/shipments/${saved.payload.shipment_id}`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return (
    <div className="space-y-6">
      <div className="space-y-4 text-center md:text-left">
        <TextLink href="/payer/shipments" icon={ArrowLeft} className="relative min-h-0 flex-row-reverse text-muted-ink after:absolute after:inset-x-0 after:-inset-y-3">Shipments</TextLink>
        <h1 className="text-headline font-medium">New shipment</h1>
        <p className="text-[14px] text-muted-ink">You approve the fee and due date now. The carrier can&apos;t be paid until the goods arrive.</p>
      </div>
      {recovery ? (
        <Card>
          <h2 className="text-heading">Finish saving your approved shipment</h2>
          <p className="my-4 text-muted-ink">
            Your approval is already submitted. Continue to check confirmation and save the trip
            without creating another shipment.
          </p>
          <Button disabled={pending} onClick={submit}>Continue saving trip</Button>
          <TransactionStatus pending={pending} step={step} error={error}
            hash={recovery.payload.shipment_id ? recovery.hash : undefined} />
        </Card>
      ) : (
        <QueryState
          loading={places.isLoading || relations.isLoading || account.isLoading || shipments.isLoading}
          error={places.error || relations.error || account.error || shipments.error}
          retry={() => { places.refetch(); relations.refetch(); account.refetch(); shipments.refetch() }}
        >
          <NewShipmentContent
            values={{ carrier, pickupId, destinationId, cargo, quantity, fee, due }}
            onChange={(field, value) => ({ carrier: setCarrier, pickupId: setPickup, destinationId: setDestination,
              cargo: setCargo, quantity: setQuantity, fee: setFee, due: setDue }[field](value))}
            carriers={connected} places={places.data ?? []} pickup={pickup} destination={destination}
            amount={amount} remaining={remaining} creditLimit={account.data?.creditLimit ?? 0n}
            outstanding={account.data?.outstanding ?? 0n} valid={valid} recoveryReady={recoveryReady}
            pending={pending} step={step} error={error} overdue={overdue}
            minDate={localDate(new Date())} maxDate={localDate(new Date(Date.now() + 60 * 86400000))}
            errors={{ quantity: quantityError || undefined,
              fee: fee ? validateShipment(fee, due, remaining, overdue)?.includes("date") ? undefined : validation : undefined,
              due: due && validation?.includes("date") ? validation : undefined }}
            onSubmit={submit}
          />
        </QueryState>
      )}
    </div>
  )
}
