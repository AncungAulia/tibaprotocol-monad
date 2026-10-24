/**
 * An error that maps directly to an HTTP response.
 * `message` is shown to end users, so keep it plain and free of jargon.
 */
export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, "bad_request", message, details)
  }

  static unauthorized(message = "Please sign in again to continue.") {
    return new HttpError(401, "unauthorized", message)
  }

  static forbidden(message = "You are not allowed to do this.") {
    return new HttpError(403, "forbidden", message)
  }

  static notFound(message = "We could not find what you were looking for.") {
    return new HttpError(404, "not_found", message)
  }

  static conflict(message: string) {
    return new HttpError(409, "conflict", message)
  }

  static gone(message: string) {
    return new HttpError(410, "gone", message)
  }

  static upstream(message = "Something on our side is not responding. Please try again in a minute.") {
    return new HttpError(502, "upstream_error", message)
  }
}
