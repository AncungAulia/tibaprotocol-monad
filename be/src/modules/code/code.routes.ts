import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import { codeParams } from "./code.schema.js"
import * as service from "./code.service.js"

export const codeRouter = Router()

codeRouter.get("/:code", requireAuth, validate({ params: codeParams }), async (req, res) => {
  const user = currentUser(req)
  res.json(await service.lookupCode(user.address, String(req.params.code)))
})
