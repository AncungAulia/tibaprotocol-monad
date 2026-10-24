import { ArrowDown, ArrowUpRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/cn"

// The TIBA pill button, as in fe/src/components/elements/Button.tsx and the Pencil components
// Button/Primary and Button/Secondary: the label on the left, a round icon circle on the right.
// Hover changes the circle, not the pill; the outbound arrow turns. Every landing button is a
// link: to a section, or out to the app.
const variants = {
  primary: { pill: "bg-ink text-white", circle: "bg-white text-ink group-hover:bg-marigold" },
  secondary: {
    pill: "border border-line-strong bg-surface text-ink",
    circle: "bg-ink text-white group-hover:bg-marigold group-hover:text-ink",
  },
}

const icons = { out: ArrowUpRight, down: ArrowDown } satisfies Record<string, LucideIcon>

export function ButtonLink({
  href,
  children,
  variant = "primary",
  icon = "out",
  block = false,
  className,
}: {
  href: string
  children: React.ReactNode
  variant?: keyof typeof variants
  icon?: keyof typeof icons
  // Full width on phones; from tablets up the button hugs its label.
  block?: boolean
  className?: string
}) {
  const Icon = icons[icon]
  const external = /^https?:\/\//.test(href)
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        "group inline-flex h-12 max-w-full shrink-0 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-[22px] text-[15px] font-medium",
        "transition-transform duration-150 ease-out active:scale-[0.97]",
        variants[variant].pill,
        block ? "w-full justify-between md:w-fit" : "w-fit",
        className,
      )}
    >
      <span className="min-w-0 truncate leading-tight">{children}</span>
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-150",
          variants[variant].circle,
        )}
      >
        <Icon
          className={cn(
            "size-[17px] transition-transform duration-150 ease-out",
            icon === "out" && "group-hover:rotate-45",
          )}
          strokeWidth={2}
        />
      </span>
    </a>
  )
}
