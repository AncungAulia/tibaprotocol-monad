import type { NextConfig } from "next"

// A static site: `next build` writes plain HTML, CSS and JS to out/, ready for any static host.
// Images are pre-compressed WebP in public/clay, so the image optimizer is not needed.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
}

export default nextConfig
