import { cn } from "@/lib/cn"
import { titles } from "@/lib/type"
import { RiseText } from "./RiseText"

// A two-line title: a sans line, then an Instrument Serif italic line, each rising letter by
// letter (RiseText). The second line starts while the first is still landing.
export function Title({
  as: Tag = "h2",
  id,
  line1,
  line2,
  size = "section",
  onLoad = false,
  delay = 0,
  className,
}: {
  as?: "h1" | "h2"
  id?: string
  line1: string
  line2: string
  size?: keyof typeof titles
  onLoad?: boolean
  delay?: number
  className?: string
}) {
  const t = titles[size]
  return (
    <Tag id={id} className={cn("flex flex-col text-ink", className)}>
      <span className={cn("block font-medium", t.line1)}>
        <RiseText text={line1} onLoad={onLoad} delay={delay} />
      </span>
      <span className={cn("block font-serif font-normal italic", t.line2)}>
        <RiseText text={line2} onLoad={onLoad} delay={delay + 240} />
      </span>
    </Tag>
  )
}
