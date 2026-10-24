import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import { submitCompanySchema, type SubmitCompanyInput } from "./payer.schema.js"
import * as service from "./payer.service.js"

export const payerRouter = Router()

payerRouter.get("/company", requireAuth, async (req, res) => {
  res.json({ company: await service.getCompanyStatus(currentUser(req).address) })
})

payerRouter.post(
  "/submit",
  requireAuth,
  validate({ body: submitCompanySchema }),
  async (req, res) => {
    const user = currentUser(req)
    const result = await service.submitCompany(user.address, req.body as SubmitCompanyInput)
    res.status(201).json(result)
  },
)
