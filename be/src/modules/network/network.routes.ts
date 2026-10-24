import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import * as service from "./network.service.js"

export const networkRouter = Router()

networkRouter.get("/", requireAuth, async (req, res) => {
  const user = currentUser(req)
  res.json(await service.getNetwork(user.address))
})
