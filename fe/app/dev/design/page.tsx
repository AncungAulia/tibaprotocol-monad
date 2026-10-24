import { notFound } from "next/navigation"
import { DesignPreview } from "@/components/dev/DesignPreview"

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <DesignPreview />
}
