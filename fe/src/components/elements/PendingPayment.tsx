"use client"

import { useTransaction } from "@/lib/ledger"
import { Button } from "./Button"
import { receiptUrl } from "@/lib/chain"

export function PendingPayment() {
  const transaction = useTransaction()
  const saved = transaction.recovery
  if (!saved) return null
  return (
    <aside
      className="mb-6 space-y-3 rounded-[24px] bg-stamp-soft p-5"
      aria-label="Unfinished payment"
    >
      <h2 className="font-medium">A payment needs confirmation</h2>
      <p>
        Check the payment you already sent before starting another one. This will not send it again.
      </p>
      <a
        href={receiptUrl(saved.hash)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center underline underline-offset-4"
      >
        View submitted payment ↗
      </a>
      <div>
        <Button
          variant="secondary"
          disabled={transaction.pending}
          onClick={() => {
            void transaction
              .run(saved.action, {
                ...saved.args,
                amount: saved.args.amount !== undefined ? BigInt(saved.args.amount) : undefined,
              })
              .catch(() => {})
          }}
        >
          {transaction.pending ? "Checking payment" : "Check confirmation"}
        </Button>
      </div>
      {transaction.error && (
        <p role="alert" className="text-danger">
          {transaction.error}
        </p>
      )}
    </aside>
  )
}
