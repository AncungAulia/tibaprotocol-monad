import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Dummy values so config/env.ts validates; no test talks to real services.
    env: {
      NODE_ENV: "test",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      PRIVY_APP_ID: "test-privy-app",
      PRIVY_APP_SECRET: "test-privy-secret",
      APP_URL: "https://app.tibaprotocol.xyz",
      DEMO_AUTO_APPROVE: "false",
    },
  },
})
