import { JoinInviteScreen } from "@/modules/onboarding/components/JoinInviteScreen"

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <JoinInviteScreen key={token} id={token} />
}
