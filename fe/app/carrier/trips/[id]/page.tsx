import { TripDetailScreen } from "@/modules/carrier/components/TripDetailScreen"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TripDetailScreen key={id} id={id} />
}
