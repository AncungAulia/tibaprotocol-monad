import { ShipmentDetailScreen } from "@/modules/payer/components/ShipmentDetailScreen"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ShipmentDetailScreen key={id} id={id} />
}
