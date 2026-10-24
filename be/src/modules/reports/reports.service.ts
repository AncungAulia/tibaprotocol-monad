import type { Address } from "viem"
import { Status, requireShipment, sameAddress } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { ReportRow } from "../../types/db.js"
import type { CreateReportInput } from "./reports.schema.js"

/**
 * Saves the warehouse's report after confirmDelivery(id, false, qty) is confirmed.
 */
export async function createReport(
  reporter: Address,
  input: CreateReportInput,
): Promise<ReportRow> {
  const shipment = await requireShipment(input.shipmentId)
  if (!sameAddress(shipment.consignee, reporter)) {
    throw HttpError.forbidden(
      "Only the receiving warehouse for this shipment can report a problem.",
    )
  }
  if (shipment.status !== Status.DISPUTED) {
    throw HttpError.conflict("Confirm the delivery problem before saving its report.")
  }
  if (shipment.receivedQty !== input.receivedQty) {
    throw HttpError.conflict("The received quantity must match the confirmed delivery.")
  }

  return unwrap(
    await supabase
      .from("reports")
      .upsert(
        {
          shipment_id: input.shipmentId,
          issues: input.issues,
          received_qty: input.receivedQty,
          note: input.note || null,
          reporter_address: reporter,
        },
        { onConflict: "shipment_id" },
      )
      .select("*")
      .single<ReportRow>(),
    "createReport",
  )
}

/** "Read the report": visible to the payer, carrier and receiver of the shipment. */
export async function getReport(viewer: Address, shipmentId: number): Promise<ReportRow> {
  const shipment = await requireShipment(shipmentId)
  const related = [shipment.payer, shipment.carrier, shipment.consignee].some((a) =>
    sameAddress(a, viewer),
  )
  if (!related) throw HttpError.forbidden("This shipment is not linked to your account.")

  const report = unwrap(
    await supabase
      .from("reports")
      .select("*")
      .eq("shipment_id", shipmentId)
      .maybeSingle<ReportRow>(),
    "getReport",
  )
  if (!report) throw HttpError.notFound("No problem was reported for this shipment.")
  return report
}
