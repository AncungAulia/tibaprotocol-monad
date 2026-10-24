import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Custom font sizes from the @theme in globals.css. Without this, tailwind-merge reads
// `text-caption` as a color and drops it when `text-ink` follows.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "hero",
        "amount",
        "headline",
        "title",
        "heading",
        "body",
        "label",
        "caption",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
