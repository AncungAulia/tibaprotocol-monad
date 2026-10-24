import cors from "cors"
import express, { Router } from "express"
import helmet from "helmet"
import { pinoHttp } from "pino-http"
import { corsOrigins } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { WALLET_HEADER } from "./middlewares/auth.js"
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js"
import { codeRouter } from "./modules/code/code.routes.js"
import { invitesRouter } from "./modules/invites/invites.routes.js"
import { locationsRouter } from "./modules/locations/locations.routes.js"
import { networkRouter } from "./modules/network/network.routes.js"
import { payerRouter } from "./modules/payer/payer.routes.js"
import { placesRouter } from "./modules/places/places.routes.js"
import { profileRouter } from "./modules/profile/profile.routes.js"
import { reportsRouter } from "./modules/reports/reports.routes.js"
import { tripsRouter } from "./modules/trips/trips.routes.js"
import { poolRouter } from "./modules/pool/pool.routes.js"
import { rateLimit } from "./middlewares/rate-limit.js"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")
  app.set("trust proxy", 1)

  app.use(helmet())
  app.use(
    cors({
      origin: corsOrigins.includes("*") ? true : corsOrigins,
      allowedHeaders: ["Authorization", "Content-Type", WALLET_HEADER],
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: "100kb" }))
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/health" },
    }),
  )

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "tiba-be", time: new Date().toISOString() })
  })

  const api = Router()
  api.use(rateLimit(300))
  api.use("/profile", profileRouter)
  api.use("/payer", payerRouter)
  api.use("/invites", invitesRouter)
  api.use("/network", networkRouter)
  api.use("/places", placesRouter)
  api.use("/trips", tripsRouter)
  api.use("/locations", locationsRouter)
  api.use("/reports", reportsRouter)
  api.use("/code", codeRouter)
  api.use("/pool", poolRouter)
  app.use("/api", api)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
