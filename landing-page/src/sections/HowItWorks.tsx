/* eslint-disable @next/next/no-img-element -- static export, pre-compressed WebP */
import { ClayIn } from "@/components/ClayIn"
import { Reveal } from "@/components/Reveal"
import { Stagger } from "@/components/Stagger"
import { Title } from "@/components/Title"
import { landing } from "@/content/landing"
import { cn } from "@/lib/cn"
import { lead } from "@/lib/type"

// Pin centres on the route panorama, in percent of the panel. The panel keeps the design's
// 1360 by 510 ratio from tablet up, so the pins stay on their buildings at every width.
const PINS = [
  { left: 13.97, top: 21.96 },
  { left: 56.03, top: 40 },
  { left: 86.03, top: 25.1 },
  { left: 78.01, top: 60 },
  { left: 11.99, top: 60 },
]

// Step 4, the payout, is the marigold one.
const PAID = 3

// Landing v2 / How it works: the route panorama with five numbered pins (tablet and desktop;
// phones show the scene alone), then the five steps. The pins pop in one after another once
// the panel is in view, then the steps rise in turn.
export function HowItWorks() {
  const s = landing.howItWorks
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="mx-auto flex max-w-[1440px] flex-col gap-7 px-4 pt-[72px] md:gap-10 md:px-8 md:pt-24 lg:gap-14 lg:px-10 lg:pt-[120px] lg:pb-10"
    >
      <div className="flex flex-col gap-3.5 md:gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <Title id="how-title" line1={s.line1} line2={s.line2} />
        <Reveal className="md:max-w-[520px] lg:max-w-[420px]">
          <p className={lead}>{s.lead}</p>
        </Reveal>
      </div>

      <ClayIn className="h-[220px] overflow-hidden rounded-3xl bg-surface-3 md:aspect-[1360/510] md:h-auto md:rounded-[28px] lg:rounded-[40px]">
        <img
          src={s.image}
          alt={s.alt}
          width={1584}
          height={672}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <Stagger
          motion="pop"
          step={170}
          delay={350}
          threshold={0.6}
          className="absolute inset-0 hidden md:block"
        >
          {PINS.map((pin, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
            >
              <span
                data-stagger
                className={cn(
                  "grid size-8 place-items-center rounded-full border-2 border-white text-[13px] font-semibold shadow-[0_8px_20px_#00000033] lg:size-11 lg:text-[18px]",
                  i === PAID ? "bg-marigold text-ink" : "bg-ink text-white",
                )}
              >
                {i + 1}
              </span>
            </span>
          ))}
        </Stagger>
      </ClayIn>

      <Stagger step={90} threshold={0.2}>
        <ol className="flex flex-col md:grid md:grid-cols-3 md:gap-x-6 md:gap-y-10 lg:grid-cols-5 lg:gap-8">
          {s.steps.map((step, i) => (
            <li
              key={step.title}
              data-stagger
              className={cn(
                "flex gap-4 border-t border-line-strong py-[18px] md:flex-col md:gap-2.5 md:border-t-2 md:pt-[18px] md:pb-0 lg:gap-3 lg:pt-5",
                i === PAID ? "md:border-marigold" : "md:border-ink",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-[30px] shrink-0 place-items-center rounded-full text-[13px] font-semibold md:size-7",
                  i === PAID ? "bg-marigold text-ink" : "bg-ink text-white",
                )}
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1 md:gap-2.5 lg:gap-3">
                <h3 className="text-[18px] leading-[1.2] font-medium md:text-[19px] lg:text-[20px] lg:tracking-[-0.4px]">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-[1.45] text-ink-2 lg:leading-normal">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Stagger>
    </section>
  )
}
