import { Check, Circle, CircleDot } from "lucide-react"
import type { Role } from "@/types/role"

const labels: Record<string, [string, string, string]> = {
  payer: ["Role", "Details", "Review"],
  carrier: ["Role", "Details", "Done"],
  investor: ["Role", "Before you start", "Done"],
}

/** Setup progress (Pencil B, C, D, E top bar): pills on desktop, "Step n of 3" on phones. */
export function OnboardingSteps({ role, step }: { role?: Role; step: 0 | 1 | 2 }) {
  const steps = labels[role ?? "payer"] ?? labels.payer
  return (
    <nav
      aria-label="Setup progress"
      className="absolute top-7 right-4 text-label font-medium md:top-8 md:right-auto md:left-1/2 md:-translate-x-1/2"
    >
      <span className="text-muted-ink md:hidden">Step {step + 1} of 3</span>
      <ol className="hidden items-center gap-2 md:flex">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 whitespace-nowrap ${
              index === step
                ? "bg-ink text-white"
                : index < step
                  ? "bg-surface text-ink"
                  : "bg-surface text-muted-ink"
            }`}
          >
            {index < step ? (
              <Check size={14} className="text-muted-ink" aria-hidden />
            ) : index === step ? (
              <CircleDot size={14} className="text-stamp" aria-hidden />
            ) : (
              <Circle size={14} aria-hidden />
            )}
            {label}
          </li>
        ))}
      </ol>
    </nav>
  )
}
