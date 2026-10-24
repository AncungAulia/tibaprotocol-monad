import { ArrowUpRight, LoaderCircle, type LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

// Pill button (DESIGN.md: Components). Filled and outlined pills always carry the icon
// circle, as in the Pencil frames: a semantic icon when there is one (Plus, Phone, QrCode...),
// ArrowUpRight otherwise. Pass `icon={null}` to drop the circle.
// Width rule: full width only on mobile or narrow containers (<= 440px), otherwise hug the label.
const buttonVariants = cva(
  "group inline-flex h-12 max-w-full items-center rounded-full text-body font-medium transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:pointer-events-none disabled:bg-subtle disabled:text-muted-ink",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white",
        // outlined pill with the dark icon circle
        secondary: "border border-line-strong bg-surface text-ink",
        moment: "bg-stamp text-ink",
        quiet: "bg-transparent text-ink",
        icon: "size-12 justify-center gap-0 bg-canvas p-0 text-ink",
      },
      // with an icon: label left, circle right; without: centered label.
      // Long labels wrap to two lines instead of overflowing at 320px.
      withIcon: {
        true: "justify-between gap-8 pr-1.5 pl-6",
        false: "justify-center gap-2 px-6 text-center",
      },
      block: { true: "w-full @min-[441px]:w-fit", false: "w-fit" },
    },
    compoundVariants: [{ variant: "icon", className: "justify-center gap-0 p-0" }],
    defaultVariants: { variant: "primary", withIcon: false, block: false },
  },
)

// Hover changes the circle, not the background
const circleVariants = {
  primary: "bg-white text-ink group-hover:bg-stamp",
  secondary: "bg-ink text-white group-hover:bg-stamp group-hover:text-ink",
  moment: "bg-ink text-white group-hover:bg-white group-hover:text-ink",
  quiet: "bg-canvas text-ink group-hover:bg-stamp",
  icon: "bg-transparent text-ink group-hover:bg-stamp",
} as const

type Variant = keyof typeof circleVariants

function iconFor(variant: Variant, icon: LucideIcon | null | undefined) {
  if (icon !== undefined) return icon ?? undefined
  return variant === "primary" || variant === "secondary" || variant === "moment"
    ? ArrowUpRight
    : undefined
}

function IconCircle({
  icon: Icon,
  variant,
  loading,
  disabled,
}: {
  icon?: LucideIcon
  variant: Variant
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-150",
        disabled || loading ? "bg-line text-muted-ink" : circleVariants[variant],
      )}
    >
      {loading ? (
        <LoaderCircle className="size-4" aria-hidden />
      ) : Icon ? (
        <Icon
          className={cn(
            "size-4 transition-transform duration-150",
            // only the outbound arrow turns on hover (DESIGN.md: Interaction rules)
            Icon === ArrowUpRight && "group-hover:rotate-45",
          )}
          aria-hidden
        />
      ) : null}
    </span>
  )
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<VariantProps<typeof buttonVariants>, "withIcon"> & {
    icon?: LucideIcon | null
    loading?: boolean
  }

export function Button({
  className,
  variant = "primary",
  block,
  icon: iconProp,
  children,
  loading = false,
  disabled,
  type = "button",
  ...props
}: Props) {
  const v = variant ?? "primary"
  const icon = iconFor(v, iconProp)
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants({ variant: v, withIcon: !!icon, block: v === "icon" ? false : block }),
        v === "icon" && "w-12",
        className,
      )}
    >
      <span className={v === "icon" ? "sr-only" : "min-w-0 leading-tight"}>{children}</span>
      {icon || v === "icon" ? (
        <IconCircle icon={icon} variant={v} loading={loading} disabled={disabled} />
      ) : loading ? (
        <LoaderCircle className="size-4 shrink-0" aria-hidden />
      ) : null}
    </button>
  )
}

export { buttonVariants }

export function ButtonLink({
  href,
  children,
  variant = "primary",
  icon: iconProp,
  block,
  className,
  target,
}: {
  href: string
  children: ReactNode
  variant?: Exclude<Variant, "icon">
  icon?: LucideIcon | null
  block?: boolean
  className?: string
  target?: string
}) {
  const icon = iconFor(variant, iconProp)
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className={cn(buttonVariants({ variant, withIcon: !!icon, block }), className)}
    >
      <span className="min-w-0 leading-tight">{children}</span>
      {icon && <IconCircle icon={icon} variant={variant} />}
    </Link>
  )
}
