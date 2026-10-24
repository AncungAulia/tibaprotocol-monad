import { receiptUrl } from "@/lib/chain"

export function TransactionStatus({
  pending,
  step,
  error,
  hash,
}: {
  pending: boolean
  step: string
  error?: string
  hash?: string
}) {
  return (
    <div aria-live="polite" className="space-y-2">
      {pending && (
        <p role="status" className="text-muted-ink">
          {step}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger break-words">
          {error}
        </p>
      )}
      {hash && (
        <p className="text-success">
          Confirmed.{" "}
          <a
            href={receiptUrl(hash)}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            View receipt ↗
          </a>
        </p>
      )}
    </div>
  )
}
