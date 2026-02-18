import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionUser } from "@/lib/session-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
    const session = await getServerSession(authOptions);
    const user = getSessionUser(session);
    if (!user.id) redirect("/login");
    redirect(`/user/${user.id}`);
}

