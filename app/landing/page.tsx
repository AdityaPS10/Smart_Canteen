import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { landingFor } from "@/lib/access";

export const dynamic = "force-dynamic";

/** After login: the role decides the landing screen. */
export default async function LandingPage() {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  redirect(landingFor(session.user.role));
}
