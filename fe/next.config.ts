import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The UI preview (scripts/ui-preview.mjs) builds into its own folder so it never clobbers `next start`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@tiba/sc"],
  webpack(config, { webpack }) {
    // Only wagmi's Base connector uses the newer SDK's browser export; Privy ships an older SDK.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@base-org\/account$/,
        (resource: { context: string; request: string }) => {
          if (/[\\/]@wagmi[\\/]connectors[\\/]/.test(resource.context))
            resource.request = "@base-org/account/browser"
        },
      ),
    )
    return config
  },
}

export default nextConfig
