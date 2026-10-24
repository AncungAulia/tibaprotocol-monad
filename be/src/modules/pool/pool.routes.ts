import { Router } from "express"
import type { Hash } from "viem"
import { z } from "zod"
import { requireAuth, currentUser } from "../../middlewares/auth.js"
import { validate } from "../../middlewares/validate.js"
import { poolHistory, recordPoolTransaction } from "./pool.service.js"
import { rateLimit } from "../../middlewares/rate-limit.js"

const recordSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Provide a valid transaction."),
})

export const poolRouter = Router()
poolRouter.get("/history", requireAuth, rateLimit(30), async (req, res) => {
  res.json(await poolHistory(currentUser(req).address))
})

// The app calls this after a deposit or withdrawal is confirmed
poolRouter.post(
  "/history",
  requireAuth,
  rateLimit(30),
  validate({ body: recordSchema }),
  async (req, res) => {
    const { txHash } = req.body as z.infer<typeof recordSchema>
    res.status(201).json(await recordPoolTransaction(currentUser(req).address, txHash as Hash))
  },
)
