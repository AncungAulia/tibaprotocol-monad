/* eslint-disable @next/next/no-img-element -- static export, pre-compressed WebP */
import { CodeXml, Coins, Lock, Timer, type LucideIcon } from "lucide-react"
import { ClayIn } from "@/components/ClayIn"
import { Stagger } from "@/components/Stagger"
import { Title } from "@/components/Title"
import { landing } from "@/content/landing"

const ICONS: LucideIcon[] = [Timer, Lock, CodeXml, Coins]

// Landing v2 / Why Monad: a bento of one big render with the "Proof anyone can check" note, and
// four white fact cards (two by two). Desktop puts them side by side, the narrower frames stack.
export function WhyMonad() {
  const w = landing.whyMonad
  return (
    <section
      id="why"
      aria-labelledby="why-title"
      className="mx-auto flex max-w-[1440px] flex-col gap-7 px-4 pt-[72px] md:gap-10 md:px-8 md:pt-24 lg:gap-14 lg:px-10 lg:pt-[120px] lg:pb-10"
    >
      <Title id="why-title" line1={w.line1} line2={w.line2} />

      <div className="flex flex-col gap-7 md:gap-4 lg:h-[600px] lg:flex-row">
        <ClayIn className="flex h-[380px] flex-col justify-end overflow-hidden rounded-[28px] bg-surface-3 p-3 md:h-[440px] md:rounded-[32px] md:p-6 lg:h-auto lg:min-w-0 lg:flex-1 lg:rounded-[40px] lg:p-10">
          <img
            src={w.proof.image}
            alt={w.proof.alt}
            width={1408}
            height={768}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="relative flex max-w-full flex-col gap-1.5 rounded-[18px] bg-white/90 p-[18px] md:w-[400px] md:gap-2 md:rounded-[22px] md:p-[22px] lg:w-[420px] lg:gap-2.5 lg:rounded-3xl lg:p-6">
            <h3 className="text-[20px] leading-tight font-medium md:text-[22px] lg:text-[24px] lg:tracking-[-0.5px]">
              {w.proof.title}
            </h3>
            <p className="text-[14px] leading-[1.45] text-ink-2 md:text-[15px] md:leading-normal">
              {w.proof.body}
            </p>
          </div>
        </ClayIn>

        <Stagger
          step={90}
          className="grid grid-cols-2 items-start gap-x-3 gap-y-7 md:items-stretch md:gap-4 lg:w-[min(600px,50%)] lg:shrink-0 lg:grid-rows-2"
        >
          {w.facts.map((fact, i) => {
            const Icon = ICONS[i]
            return (
              <div
                key={fact.label}
                data-stagger
                className="flex min-w-0 flex-col gap-7 rounded-3xl border border-line bg-surface p-[clamp(14px,4.6vw,18px)] md:gap-10 md:rounded-[28px] md:p-6 lg:justify-between lg:rounded-[32px] lg:p-7"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[clamp(22px,7.2vw,28px)] leading-none font-medium tracking-[-1px] md:text-[48px] md:tracking-[-2px] lg:text-[clamp(36px,calc(56px_+_(100vw_-_1440px)*0.048),56px)] lg:tracking-[-2.4px]">
                    {fact.value}
                  </p>
                  <span
                    aria-hidden
                    className="grid size-[clamp(24px,7.7vw,30px)] shrink-0 place-items-center rounded-full bg-canvas md:size-9 lg:size-10"
                  >
                    <Icon className="size-3.5 md:size-4 lg:size-[18px]" strokeWidth={2} />
                  </span>
                </div>
                <div className="flex flex-col gap-1 md:gap-1.5">
                  <h3 className="text-[14px] font-semibold md:text-[15px] lg:text-[16px]">
                    {fact.label}
                  </h3>
                  <p className="text-[13px] leading-[1.45] text-ink-2 md:text-[14px]">
                    <span className="md:hidden">{fact.short}</span>
                    <span className="hidden md:inline">{fact.body}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}
