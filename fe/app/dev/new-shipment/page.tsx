import { notFound } from "next/navigation"
import { NewShipmentPendingPreview } from "@/components/dev/NewShipmentPendingPreview"

export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_UI_PREVIEW !== "1") notFound()
  return <NewShipmentPendingPreview />
}
