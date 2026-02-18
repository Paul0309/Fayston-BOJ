import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session-user";
import { withDbRetry } from "@/lib/db-retry";

export async function getCurrentUser() {
    const session = await getServerSession(authOptions);
    const userId = getSessionUser(session).id;

    if (!userId) return null;

    return withDbRetry(() => db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, email: true }
    }));
}

export async function isAdmin() {
    const user = await getCurrentUser();
    return user?.role === "ADMIN";
}
