import type { NextFunction, Request, Response } from "express"
import { ZodError } from "zod"
import { HttpError } from "../lib/http-error.js"

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound("This page does not exist."))
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0]
    res.status(400).json({
      error: {
        code: "invalid_input",
        message: first ? describeIssue(first.path, first.message) : "Some details are missing.",
        details: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    })
    return
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) req.log?.error({ err }, err.message)
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    })
    return
  }

  // Malformed JSON from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "invalid_json", message: "We could not read that request." } })
    return
  }

  req.log?.error({ err }, "unhandled error")
  res.status(500).json({
    error: { code: "internal_error", message: "Something went wrong on our side. Please try again." },
  })
}

function describeIssue(path: PropertyKey[], message: string): string {
  const field = path.filter((p) => typeof p === "string").at(-1)
  if (!field) return message
  const label = String(field)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
  return `Please check the ${label}: ${message.charAt(0).toLowerCase()}${message.slice(1)}`
}
