import { createApp } from "./app.js"
import { env } from "./config/env.js"
import { adminAccount } from "./lib/chain.js"
import { logger } from "./lib/logger.js"

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      autoApprove: env.DEMO_AUTO_APPROVE,
      admin: adminAccount?.address ?? null,
      routing: env.ORS_API_KEY ? "openrouteservice" : "straight-line",
    },
    "TIBA backend listening",
  )
  if (env.DEMO_AUTO_APPROVE && !adminAccount) {
    logger.warn("DEMO_AUTO_APPROVE is on but ADMIN_PRIVATE_KEY is missing; payer approval will fail")
  }
})

function shutdown(signal: string) {
  logger.info({ signal }, "shutting down")
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled promise rejection")
})
