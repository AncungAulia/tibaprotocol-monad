import { defineConfig } from "vitest/config"

// Live end-to-end run: real be/.env, real Supabase, real Monad testnet. Not part of `pnpm test`.
process.loadEnvFile(".env")

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/e2e/**/*.e2e.ts"],
    testTimeout: 15 * 60_000,
    hookTimeout: 5 * 60_000,
    fileParallelism: false,
  },
})
