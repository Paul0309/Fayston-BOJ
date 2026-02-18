import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAiReviewsPage() {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
        redirect("/");
    }
    redirect("/admin/ai-management");
}
