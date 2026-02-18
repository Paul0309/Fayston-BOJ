import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import AdminAiManagementPanel from "@/components/AdminAiManagementPanel";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAiManagementPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-neutral-900">
      <AdminSidebar />
      <main className="flex-1 lg:ml-64 py-8 px-4 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-100">AI 관리</h1>
            <p className="mt-1 text-sm text-neutral-400">
              AI 자동 문제 생성, 설명 점검, 프롬프트 기반 문제 수정, 자동화 스케줄을 관리합니다.
            </p>
          </div>
          <AdminAiManagementPanel />
        </div>
      </main>
    </div>
  );
}

