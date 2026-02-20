import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import DuelBattleClient from "@/components/DuelBattleClient";

export const dynamic = "force-dynamic";

export default async function ArenaBattlePage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUser(session).id;
  if (!userId) redirect("/login");

  const { id } = await props.params;
  return (
    <div className="container mx-auto py-6 px-4">
      <DuelBattleClient battleId={id} myUserId={userId} />
    </div>
  );
}

