import { redirect } from "next/navigation"

// The app always starts at the connect + role check screen (Pencil A, B).
// Once a profile exists, the start screen sends the user to their role home.
export default function Page() {
  redirect("/start")
}
