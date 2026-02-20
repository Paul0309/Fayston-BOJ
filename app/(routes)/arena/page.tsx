import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import DuelDashboardClient from "@/components/DuelDashboardClient";

export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUser(session).id;
  if (!userId) redirect("/login");

  return (
    <div className="container mx-auto py-8 px-4">
      <DuelDashboardClient />
    </div>
  );
}

