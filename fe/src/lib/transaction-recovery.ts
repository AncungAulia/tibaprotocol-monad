export type PaymentAction =
  "pickup" | "confirm" | "advance" | "repay" | "deposit" | "withdraw" | "faucet"
export type PaymentArgs = { id?: string; amount?: bigint; accepted?: boolean; quantity?: number }
export type PendingPayment = {
  hash: `0x${string}`
  action: PaymentAction
  args: Omit<PaymentArgs, "amount"> & { amount?: string }
}
export function readPendingPayment(raw: string | null): PendingPayment | undefined {
  if (!raw) return undefined
  const value = JSON.parse(raw)
  if (
    !value ||
    !/^0x[\da-f]{64}$/i.test(value.hash) ||
    !["pickup", "confirm", "advance", "repay", "deposit", "withdraw", "faucet"].includes(
      value.action,
    ) ||
    !value.args ||
    typeof value.args !== "object"
  )
    throw new Error(
      "The previous payment record could not be read. Check your wallet before making another payment.",
    )
  if (
    value.args.amount !== undefined &&
    (typeof value.args.amount !== "string" || !/^\d+$/.test(value.args.amount))
  )
    throw new Error("The previous payment amount could not be read.")
  if (
    value.args.id !== undefined &&
    (typeof value.args.id !== "string" || !/^\d+$/.test(value.args.id))
  )
    throw new Error("The previous shipment reference could not be read.")
  return value
}
export function paymentArgs(args: PaymentArgs): PendingPayment["args"] {
  return {
    ...args,
    ...(args.amount !== undefined ? { amount: args.amount.toString() } : {}),
  } as PendingPayment["args"]
}
export function samePayment(saved: PendingPayment, action: PaymentAction, args: PaymentArgs) {
  const expected = paymentArgs(args)
  return (
    saved.action === action &&
    saved.args.id === expected.id &&
    saved.args.amount === expected.amount &&
    saved.args.accepted === expected.accepted &&
    saved.args.quantity === expected.quantity
  )
}
