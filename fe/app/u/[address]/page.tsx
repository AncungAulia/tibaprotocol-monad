import { PublicProfileScreen } from "@/modules/profile/components/PublicProfileScreen"

export default async function Page({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  return <PublicProfileScreen key={address} address={address} />
}
