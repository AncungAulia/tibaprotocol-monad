import { notFound } from "next/navigation"
import { PayerPaymentPreview } from "@/components/dev/PayerPaymentPreview"

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_UI_PREVIEW !== "1") notFound()
  const { state } = await searchParams
  return <PayerPaymentPreview initialState={state ?? "pay"} />
}
