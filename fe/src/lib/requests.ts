/** Explicit adapters between persisted UI drafts and the API's camelCase requests. */
export function companyRequest(
  form: {
    company_name: string
    registration_no: string
    country: string
    province: string
    city: string
    street: string
    postal_code: string
    contact_name: string
    contact_role: string
    trips_per_month: string
    spend_per_month: string
  },
  phone: string,
) {
  return {
    companyName: form.company_name.trim(),
    registrationNo: form.registration_no,
    country: form.country,
    province: form.province,
    city: form.city,
    street: form.street,
    postalCode: form.postal_code,
    contactName: form.contact_name.trim(),
    contactRole: form.contact_role,
    tripsPerMonth: Number(form.trips_per_month),
    spendPerMonth: Number(form.spend_per_month),
    phone,
  }
}
export function tripRequest(draft: {
  shipment_id?: string
  pickup_place: string
  destination_place: string
  cargo: string
  quantity?: number
}) {
  return {
    shipmentId: draft.shipment_id,
    pickupPlaceId: draft.pickup_place,
    destinationPlaceId: draft.destination_place,
    cargo: draft.cargo,
    ...(draft.quantity ? { quantity: draft.quantity } : {}),
  }
}
export function reportRequest(draft: {
  shipment_id: string
  received_qty: number
  note: string
  issues: string[]
}) {
  return {
    shipmentId: draft.shipment_id,
    receivedQty: draft.received_qty,
    note: draft.note,
    issues: draft.issues.map((issue) => issue.toLowerCase().replaceAll(" ", "_")),
  }
}
export function locationRequest(id: string, lat: number, lng: number, recordedAt: string) {
  return { shipmentId: id, lat, lng, recordedAt }
}
