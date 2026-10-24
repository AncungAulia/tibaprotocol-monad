import { notFound } from "next/navigation"
import { ComponentPreview } from "@/components/dev/ComponentPreview"

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <ComponentPreview />
}
