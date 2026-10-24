/* eslint-disable @next/next/no-img-element -- static export, pre-compressed WebP */
import { ClayIn } from "@/components/ClayIn"
import { Reveal } from "@/components/Reveal"
import { RoleGallery } from "@/components/RoleGallery"
import { Title } from "@/components/Title"
import { landing } from "@/content/landing"
import { cn } from "@/lib/cn"
import { lead } from "@/lib/type"

// Desktop render heights from the design, tall and short in turn; bottom-aligned, the cards
// step up and down across the row.
const DESKTOP_HEIGHT = ["lg:h-[440px]", "lg:h-[380px]", "lg:h-[440px]", "lg:h-[380px]"]

// Which description each frame uses: the Shippers card is shorter on tablet and phone, the
// Warehouses card only on phone.
const SHORT_BELOW = ["lg", "none", "md", "none"] as const

// Landing v2 / Who it's for: four role cards, each a render with a tag, a line and a sentence.
export function WhoItsFor() {
  const w = landing.whoItsFor
  return (
    <section
      id="who"
      aria-labelledby="who-title"
      className="mx-auto flex max-w-[1440px] flex-col gap-7 px-4 pt-[72px] md:gap-10 md:px-8 md:pt-24 lg:gap-14 lg:px-10 lg:pt-[120px] lg:pb-10"
    >
      <div className="flex flex-col gap-3.5 md:gap-4 lg:gap-5">
        <Title id="who-title" line1={w.line1} line2={w.line2} className="lg:gap-5" />
        <Reveal className="md:max-w-[520px] lg:max-w-none">
          <p className={lead}>{w.lead}</p>
        </Reveal>
      </div>

      <RoleGallery count={w.roles.length} label={w.line1 + " " + w.line2}>
        {w.roles.map((role, i) => (
          <article
            key={role.tag}
            className="flex w-[280px] shrink-0 snap-start flex-col gap-4 md:w-auto lg:min-w-0 lg:flex-1 lg:gap-5"
          >
            <ClayIn
              delay={i * 90}
              className={cn(
                "h-[300px] overflow-hidden rounded-3xl bg-surface-3 md:h-[360px] md:rounded-[28px] lg:rounded-[32px]",
                DESKTOP_HEIGHT[i],
              )}
            >
              <img
                src={role.image}
                alt={role.alt}
                width={1408}
                height={768}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
              <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[12px] leading-none font-medium md:top-3.5 md:left-3.5 lg:top-4 lg:left-4 lg:px-3.5 lg:py-[7px] lg:text-[13px]">
                {role.tag}
              </span>
            </ClayIn>
            <div className="flex flex-col gap-4 lg:gap-2 lg:px-1">
              <h3 className="text-[20px] leading-[1.2] font-medium tracking-[-0.4px] md:text-[21px] lg:text-[22px] lg:tracking-[-0.5px]">
                {role.title}
              </h3>
              <p className="text-[15px] leading-[1.45] text-ink-2 lg:leading-normal">
                {SHORT_BELOW[i] === "none" ? (
                  role.body
                ) : (
                  <>
                    <span className={SHORT_BELOW[i] === "lg" ? "lg:hidden" : "md:hidden"}>
                      {role.short}
                    </span>
                    <span
                      className={SHORT_BELOW[i] === "lg" ? "hidden lg:inline" : "hidden md:inline"}
                    >
                      {role.body}
                    </span>
                  </>
                )}
              </p>
            </div>
          </article>
        ))}
      </RoleGallery>
    </section>
  )
}
