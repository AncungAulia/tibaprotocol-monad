import { randomBytes } from "node:crypto"
import type { Address } from "viem"
import { env } from "../../config/env.js"
import { getPayerStats, sameAddress } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { InviteRow } from "../../types/db.js"
import { getPlace } from "../places/places.service.js"
import { getCompany, getProfile, requireRole } from "../profile/profile.service.js"
import type { AcceptInviteInput, CreateInviteInput } from "./invites.schema.js"

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 12 random bytes give 16 URL-safe characters. */
export function generateInviteToken(): string {
  return randomBytes(12).toString("base64url")
}

export function inviteUrl(token: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/join/${token}`
}

export type InviteState = "valid" | "expired" | "used"

export function inviteState(
  invite: Pick<InviteRow, "used_by" | "expires_at">,
  now = Date.now(),
): InviteState {
  if (invite.used_by) return "used"
  if (new Date(invite.expires_at).getTime() <= now) return "expired"
  return "valid"
}

async function getInvite(token: string): Promise<InviteRow | null> {
  return unwrap(
    await supabase.from("invites").select("*").eq("token", token).maybeSingle<InviteRow>(),
    "getInvite",
  )
}

export async function createInvite(payer: Address, input: CreateInviteInput) {
  await requireRole(payer, "payer")

  if (input.kind === "warehouse") {
    const place = input.placeId ? await getPlace(input.placeId) : null
    if (!place || !sameAddress(place.payer_address, payer)) {
      throw HttpError.badRequest("Choose one of your saved destinations.")
    }
    if (place.kind !== "destination") {
      throw HttpError.badRequest("Warehouse invites need a destination, not a pickup point.")
    }
  }

  const invite = unwrap(
    await supabase
      .from("invites")
      .insert({
        token: generateInviteToken(),
        kind: input.kind,
        payer_address: payer,
        label: input.label ?? null,
        place_id: input.kind === "warehouse" ? input.placeId : null,
        receiver_email: input.kind === "warehouse" ? (input.receiverEmail ?? null) : null,
        expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      })
      .select("*")
      .single<InviteRow>(),
    "createInvite",
  )

  return { invite, url: inviteUrl(invite.token) }
}

export async function listInvites(payer: Address) {
  await requireRole(payer, "payer")
  const invites = unwrap(
    await supabase
      .from("invites")
      .select("*")
      .eq("payer_address", payer)
      .order("created_at", { ascending: false })
      .overrideTypes<InviteRow[], { merge: false }>(),
    "listInvites",
  )
  return invites.map((invite) => ({
    ...invite,
    state: inviteState(invite),
    url: inviteUrl(invite.token),
  }))
}

/** Public preview for /join/[token]. */
export async function previewInvite(token: string) {
  const invite = await getInvite(token)
  if (!invite) throw HttpError.notFound("This invite link does not exist. Ask for a new one.")

  const [inviter, company, place, stats] = await Promise.all([
    getProfile(invite.payer_address),
    getCompany(invite.payer_address),
    invite.place_id ? getPlace(invite.place_id) : Promise.resolve(null),
    getPayerStats(invite.payer_address as Address),
  ])

  return {
    token: invite.token,
    kind: invite.kind,
    label: invite.label,
    state: inviteState(invite),
    expiresAt: invite.expires_at,
    inviter: {
      address: invite.payer_address,
      name: inviter?.name ?? null,
      companyName: company?.company_name ?? null,
      city: company?.city ?? null,
      verified: company?.review_status === "approved",
      creditLimit: company?.credit_limit ?? null,
      // Payment record from the contract, so carriers can judge a company before joining
      repaidCount: stats?.repaidCount ?? null,
      lateCount: stats?.lateCount ?? null,
    },
    place: place ? { id: place.id, name: place.name, address: place.address } : null,
  }
}

export async function acceptInvite(
  token: string,
  user: { address: Address; email: string | null },
  input: AcceptInviteInput,
) {
  const invite = await getInvite(token)
  if (!invite) throw HttpError.notFound("This invite link does not exist. Ask for a new one.")

  if (sameAddress(invite.payer_address, user.address)) {
    throw HttpError.badRequest(
      "You can't accept your own invite. Share the link with the person you invited.",
    )
  }

  const state = inviteState(invite)
  if (state === "used") {
    if (sameAddress(invite.used_by, user.address)) return { invite, alreadyAccepted: true }
    throw HttpError.gone("This invite link was already used. Ask for a new one.")
  }
  if (state === "expired") throw HttpError.gone("This invite link has expired. Ask for a new one.")

  const profile = await getProfile(user.address)
  if (invite.kind === "carrier") {
    if (!profile) {
      throw HttpError.conflict(
        "Please set up your carrier account first, then open the link again.",
      )
    }
    if (profile.role !== "carrier") {
      throw HttpError.conflict(
        `This wallet is set up as a ${profile.role}. Use a carrier wallet to accept.`,
      )
    }
  } else if (profile && profile.role !== "warehouse") {
    throw HttpError.conflict(
      `This wallet is set up as a ${profile.role}. Sign in with your work email instead.`,
    )
  }

  const result = await supabase.rpc("accept_invite", {
    p_token: token,
    p_address: user.address,
    p_name: input.name ?? null,
    p_email: user.email,
  })
  if (result.error?.code === "P0001") {
    const code = result.error.message
    if (code === "invite_used" || code === "invite_expired")
      throw HttpError.gone("This invitation has expired or was already used.")
    if (code === "invite_not_found") throw HttpError.notFound("This invite link does not exist.")
    if (code === "receiver_email_mismatch")
      throw HttpError.forbidden("Sign in with the email invited to this warehouse.")
    throw HttpError.conflict(
      "This account or destination cannot accept this invitation. Ask for a new link.",
    )
  }
  return unwrap<{ invite: InviteRow; alreadyAccepted: boolean }>(result, "acceptInvite")
}
