import { Router } from "express"
import { currentUser, requireAuth } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import {
  acceptInviteSchema,
  createInviteSchema,
  tokenParams,
  type AcceptInviteInput,
  type CreateInviteInput,
} from "./invites.schema.js"
import * as service from "./invites.service.js"

export const invitesRouter = Router()

invitesRouter.get("/", requireAuth, async (req, res) => {
  const user = currentUser(req)
  res.json({ invites: await service.listInvites(user.address) })
})

invitesRouter.post("/", requireAuth, validate({ body: createInviteSchema }), async (req, res) => {
  const user = currentUser(req)
  const result = await service.createInvite(user.address, req.body as CreateInviteInput)
  res.status(201).json(result)
})

invitesRouter.get("/:token", validate({ params: tokenParams }), async (req, res) => {
  res.json(await service.previewInvite(String(req.params.token)))
})

invitesRouter.post(
  "/:token/accept",
  requireAuth,
  validate({ params: tokenParams, body: acceptInviteSchema }),
  async (req, res) => {
    const user = currentUser(req)
    const result = await service.acceptInvite(
      String(req.params.token),
      user,
      req.body as AcceptInviteInput,
    )
    res.json(result)
  },
)
