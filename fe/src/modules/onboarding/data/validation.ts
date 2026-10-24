export function inviteState(
  invite: { expires_at: string; used_by?: string | null },
  now = Date.now(),
) {
  if (invite.used_by) return "used"
  const expiry = Date.parse(invite.expires_at)
  return !Number.isFinite(expiry) || expiry <= now ? "expired" : "active"
}

export function positiveInteger(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
}

export function safeProfileUrl(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined
  } catch {
    return undefined
  }
}
