import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import {
  createPlaceSchema,
  listPlacesQuery,
  searchPlacesQuery,
  type CreatePlaceInput,
  type ListPlacesQuery,
} from "./places.schema.js"
import * as service from "./places.service.js"
import { rateLimit } from "../../middlewares/rate-limit.js"

export const placesRouter = Router()

placesRouter.get(
  "/search",
  requireAuth,
  rateLimit(30),
  validate({ query: searchPlacesQuery }),
  async (req, res) => {
    res.json(await service.searchPlaces(currentUser(req).address, String(req.query.q)))
  },
)

placesRouter.get("/", requireAuth, validate({ query: listPlacesQuery }), async (req, res) => {
  const user = currentUser(req)
  const places = await service.listPlaces(user.address, req.query as ListPlacesQuery)
  res.json({ places })
})

placesRouter.post("/", requireAuth, validate({ body: createPlaceSchema }), async (req, res) => {
  const user = currentUser(req)
  const place = await service.createPlace(user.address, req.body as CreatePlaceInput)
  res.status(201).json({ place })
})
