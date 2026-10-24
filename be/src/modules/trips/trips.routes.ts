import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import { shipmentIdParams } from "../../lib/validation.js"
import {
  createTripSchema,
  updateTripSchema,
  type CreateTripInput,
  type UpdateTripInput,
} from "./trips.schema.js"
import * as service from "./trips.service.js"

export const tripsRouter = Router()

tripsRouter.get("/", requireAuth, async (req, res) => {
  const user = currentUser(req)
  res.json({ trips: await service.listTrips(user.address) })
})

tripsRouter.post("/", requireAuth, validate({ body: createTripSchema }), async (req, res) => {
  const user = currentUser(req)
  const { trip, created } = await service.createTrip(user.address, req.body as CreateTripInput)
  res.status(created ? 201 : 200).json({ trip })
})

tripsRouter.get("/:id", requireAuth, validate({ params: shipmentIdParams }), async (req, res) => {
  const user = currentUser(req)
  res.json(await service.getTripDetail(user.address, Number(req.params.id)))
})

tripsRouter.patch(
  "/:id",
  requireAuth,
  validate({ params: shipmentIdParams, body: updateTripSchema }),
  async (req, res) => {
    const user = currentUser(req)
    const trip = await service.updateTrip(
      user.address,
      Number(req.params.id),
      req.body as UpdateTripInput,
    )
    res.json({ trip })
  },
)
