import { Router } from "express"
import type { Address } from "viem"
import { topUpGas } from "../../lib/gas.js"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import { addressParams, createProfileSchema, type CreateProfileInput } from "./profile.schema.js"
import * as service from "./profile.service.js"
import { rateLimit } from "../../middlewares/rate-limit.js"

export const profileRouter = Router()

profileRouter.get("/me", requireAuth, async (req, res) => {
  const user = currentUser(req)
  res.json(await service.getMe(user.address))
})

profileRouter.post("/", requireAuth, validate({ body: createProfileSchema }), async (req, res) => {
  const user = currentUser(req)
  const profile = await service.saveProfile(
    user.address,
    req.body as CreateProfileInput,
    user.email,
  )
  res.status(201).json({ profile })
})

// Email wallets start with 0 MON. The app calls this once after sign-in so they can pay network fees.
profileRouter.post("/gas", requireAuth, rateLimit(5), async (req, res) => {
  res.json(await topUpGas(currentUser(req)))
})

profileRouter.get("/:address", validate({ params: addressParams }), async (req, res) => {
  res.json(await service.getPublicProfile(req.params.address as Address))
})
