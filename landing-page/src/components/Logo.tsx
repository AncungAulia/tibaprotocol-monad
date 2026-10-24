/* eslint-disable @next/next/no-img-element -- static export, plain SVG files from public/ */

// The TIBA horizontal logo (symbol and wordmark), copied from tibaprotocol/design/logo.
// Sized by height; the file is 668 by 243.
export function Logo({ className, alt = "TIBA" }: { className?: string; alt?: string }) {
  return <img src="/tiba-horizontal.svg" alt={alt} width={668} height={243} className={className} />
}

// The wordmark alone, its viewBox cropped tight to the letters so it can be sized to a width and
// is never cut off. Used for the giant "tiba" in the hero and the footer.
export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src="/tiba-wordmark.svg"
      alt=""
      aria-hidden
      width={356}
      height={153}
      className={className}
    />
  )
}
