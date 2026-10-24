/**
 * Shipment id from a delivery QR. Any http(s) link works (the driver may use another copy of the
 * app, such as a preview link or a laptop on the same network), as long as the path is exactly
 * /confirm/<id>. A bare id or bare path is accepted too.
 */
export function scannedShipmentId(value: string, origin: string): string {
  const text = value.trim()
  if (/^(0|[1-9]\d*)$/.test(text)) return text
  let url: URL
  try {
    url = new URL(text, origin)
  } catch {
    throw new Error("Scan a TIBA shipment QR from this app.")
  }
  const match = /^\/confirm\/(0|[1-9]\d*)\/?$/.exec(url.pathname)
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !match ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("Scan a TIBA shipment QR from this app.")
  return match[1]
}

export function quantityError(value: string, expected?: number): string | undefined {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 4294967295)
    return "Enter a whole number of items received."
  if (expected !== undefined && Number(value) > expected)
    return `Enter no more than ${expected} items.`
}
