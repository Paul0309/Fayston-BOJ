import { Session } from "next-auth";

type SessionUser = {
    id?: string;
    role?: string;
    division?: string;
    name?: string | null;
    email?: string | null;
};

export function getSessionUser(session: Session | null): SessionUser {
    if (!session?.user) return {};
    return {
        id: session.user.id,
        role: session.user.role,
        division: session.user.division,
        name: session.user.name,
        email: session.user.email
    };
}
