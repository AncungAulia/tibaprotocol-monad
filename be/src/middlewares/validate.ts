import type { NextFunction, Request, Response } from "express"
import type { ZodType } from "zod"

interface Schemas {
  body?: ZodType
  params?: ZodType
  query?: ZodType
}

/**
 * Validates and coerces request parts with Zod. Parsed values replace the originals,
 * so handlers can trust `req.body`, `req.params` and `req.query`.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) req.params = schemas.params.parse(req.params) as Request["params"]
    if (schemas.query) {
      const query = schemas.query.parse(req.query)
      // Express 5 exposes req.query as a getter, so redefine it.
      Object.defineProperty(req, "query", { value: query, writable: true, configurable: true })
    }
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {})
    next()
  }
}
