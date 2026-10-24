import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import { shipmentIdParams } from "../../lib/validation.js"
import { createReportSchema, type CreateReportInput } from "./reports.schema.js"
import * as service from "./reports.service.js"

export const reportsRouter = Router()

reportsRouter.post("/", requireAuth, validate({ body: createReportSchema }), async (req, res) => {
  const user = currentUser(req)
  const report = await service.createReport(user.address, req.body as CreateReportInput)
  res.status(201).json({ report })
})

reportsRouter.get("/:id", requireAuth, validate({ params: shipmentIdParams }), async (req, res) => {
  const user = currentUser(req)
  res.json({ report: await service.getReport(user.address, Number(req.params.id)) })
})
