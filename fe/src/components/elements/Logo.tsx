import Image from "next/image"

export function Logo({ height = 28 }: { height?: number }) {
  return <Image src="/brand/tiba-horizontal.svg" alt="tiba" height={height} width={Math.round(height * 3.2)} priority />
}
