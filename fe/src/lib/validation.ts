import { chainErrorMessage } from "./chain-errors"

export function amountError(value: string, maximum?: bigint): string | undefined {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return "Enter an amount with up to 6 decimal places."
  const [whole, fraction = ""] = value.split(".")
  const raw = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"))
  if (raw <= 0n) return "Enter an amount greater than zero."
  if (maximum !== undefined && raw > maximum) return "This is more than the amount available."
}
export function nibError(value: string) {
  return /^\d{13}$/.test(value)
    ? undefined
    : "Enter the 13 digits of your business registration number."
}
export function plateError(value: string) {
  return /^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{0,3}$/.test(value.trim().toUpperCase())
    ? undefined
    : "Enter a plate such as AB 1234 CD."
}
export function dueDateError(value: string, now = Date.now()) {
  const time = Date.parse(`${value}T00:00:00`)
  const date = new Date(time)
  const actual = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  return !Number.isFinite(time) || actual !== value || time <= now || time > now + 60 * 86400000
    ? "Choose a future due date within 60 days."
    : undefined
}
export function canAct(status: number, action: "pickup" | "confirm" | "advance" | "repay") {
  return action === "pickup"
    ? status === 1
    : action === "confirm"
      ? status === 2
      : action === "advance"
        ? status === 3
        : status === 3 || status === 5
}
export function errorMessage(error: unknown) {
  return (
    chainErrorMessage(error) ??
    (error instanceof Error ? error.message : "Something went wrong. Please try again.")
  )
}
