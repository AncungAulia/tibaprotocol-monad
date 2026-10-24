import { z } from "zod"

export const codeParams = z.object({
  code: z.string().trim().min(1, "Type the 6-character code.").max(20, "That code is too long."),
})
