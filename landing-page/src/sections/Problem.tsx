/* eslint-disable @next/next/no-img-element -- static export, pre-compressed WebP */
import { ClayIn } from "@/components/ClayIn"
import { Reveal } from "@/components/Reveal"
import { TileRow, type Tile } from "@/components/TileRow"
import { Title } from "@/components/Title"
import { landing } from "@/content/landing"

// A day per tile. Desktop draws 18, the narrower frames 12: the six extra tiles (`wideOnly`) are
// waiting days in the usual row and empty days in the TIBA row.
const USUAL: Tile[] = [...Array<Tile>(17).fill("grey"), "ink"]
const WITH_TIBA: Tile[] = ["grey", "marigold", ...Array<Tile>(16).fill("empty")]
const USUAL_WIDE = [11, 12, 13, 14, 15, 16]
const TIBA_WIDE = [12, 13, 14, 15, 16, 17]

// Landing v2 / Problem: a white card with the copy and the tile comparison beside the waiting
// render (the render on top on phones). The usual row fills slowly, tile by tile, before it
// lands on black; the TIBA row is filled almost at once and lands on marigold.
export function Problem() {
  const p = landing.problem
  return (
    <section
      aria-labelledby="problem-title"
      className="mx-auto max-w-[1440px] px-4 pt-16 md:px-8 md:pt-24 lg:px-10 lg:pt-[120px]"
    >
      <div className="flex flex-col gap-7 rounded-[28px] bg-surface px-3 pt-3 pb-7 md:flex-row md:items-center md:gap-8 md:rounded-[36px] md:py-4 md:pr-4 md:pl-10 lg:gap-14 lg:rounded-[40px] lg:py-6 lg:pr-6 lg:pl-[72px]">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-6 px-3 md:order-1 md:gap-7 md:px-0 md:py-7 lg:gap-10 lg:py-12">
          <div className="flex flex-col gap-3.5 md:gap-7 lg:gap-10">
            <Title id="problem-title" size="card" line1={p.line1} line2={p.line2} />
            <Reveal>
              <p className="text-[16px] leading-normal text-ink-2 lg:text-[18px]">{p.body}</p>
            </Reveal>
          </div>
          <div className="flex flex-col gap-5 md:gap-[18px] lg:gap-6">
            <div className="flex flex-col gap-2 lg:gap-2.5">
              <p className="flex justify-between gap-3 text-[14px] lg:text-[15px]">
                <span className="font-medium text-ink">{p.usual.title}</span>
                <span className="text-muted">{p.usual.meta}</span>
              </p>
              <TileRow tiles={USUAL} wideOnly={USUAL_WIDE} step={140} />
            </div>
            <div className="flex flex-col gap-2 lg:gap-2.5">
              <p className="flex justify-between gap-3 text-[14px] lg:text-[15px]">
                <span className="font-medium text-ink">{p.tiba.title}</span>
                <span className="font-medium text-marigold-deep">{p.tiba.meta}</span>
              </p>
              <TileRow tiles={WITH_TIBA} wideOnly={TIBA_WIDE} step={120} delay={200} />
            </div>
          </div>
        </div>
        <ClayIn className="order-1 aspect-[334/279] w-full shrink-0 overflow-hidden rounded-[20px] bg-surface-3 md:order-2 md:aspect-[360/300] md:w-[min(360px,50%)] md:rounded-3xl lg:aspect-[620/517] lg:w-[min(620px,50%)] lg:rounded-[28px]">
          <img
            src={p.image}
            alt={p.alt}
            width={1408}
            height={768}
            loading="lazy"
            className="size-full object-cover"
          />
        </ClayIn>
      </div>
    </section>
  )
}
