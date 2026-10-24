import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import { createLocationSchema, type CreateLocationInput } from "./locations.schema.js"
import * as service from "./locations.service.js"

export const locationsRouter = Router()

locationsRouter.post(
  "/",
  requireAuth,
  validate({ body: createLocationSchema }),
  async (req, res) => {
    const user = currentUser(req)
    const location = await service.recordLocation(user.address, req.body as CreateLocationInput)
    res.status(201).json({ location })
  },
)
