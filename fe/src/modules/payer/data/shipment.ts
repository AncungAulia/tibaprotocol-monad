import { Status } from "../../../lib/contracts"
import { amountError, dueDateError } from "../../../lib/validation"
import type { Shipment } from "../../../lib/types"
export const isBill = (s: Shipment) => s.status === Status.FINANCED || s.status === Status.DELIVERED
export function homeShipmentRows(rows: Shipment[], tab: string) {
  return rows.filter((s) =>
    tab === "Created"
      ? s.status === Status.APPROVED
      : tab === "History"
        ? s.status === Status.REPAID
        : [Status.IN_TRANSIT, Status.DELIVERED, Status.FINANCED, Status.DISPUTED].includes(
            s.status,
          ),
  )
}
export const isOverdue = (s: Shipment, now = Date.now()) =>
  s.status === Status.FINANCED && (s.dueDate + 60n) * 1000n < BigInt(now)
export function validateShipment(
  amount: string,
  due: string,
  remaining: bigint,
  overdue: boolean,
  now = Date.now(),
) {
  if (overdue) return "Repay overdue bills before creating a shipment."
  const feeError = amountError(amount, remaining)
  if (feeError) return feeError
  return dueDateError(due, now)
}
