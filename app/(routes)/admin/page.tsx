import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import AdminProblemForm from "@/components/AdminProblemForm";
import AdminContestsPanel from "@/components/AdminContestsPanel";
import { getCurrentUser } from "@/lib/auth";
import { getAllowedLanguages } from "@/lib/language-settings";
import { getAdminMonitorSnapshot } from "@/lib/admin-monitor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  const [allowedLanguages, monitor] = await Promise.all([getAllowedLanguages(), getAdminMonitorSnapshot()]);

  return (
    <div className="flex min-h-screen bg-neutral-900">
      <AdminSidebar />

      <main className="flex-1 lg:ml-64 py-8 px-4 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-100">관리자 대시보드</h1>
            <p className="mt-1 text-sm text-neutral-400">채점 상태, 문제, USACO 대회를 관리합니다.</p>
          </div>

          <section id="monitoring" className="mb-8">
            <h2 className="text-lg font-bold text-neutral-100 mb-4">채점 상태</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricsCard label="대기" value={monitor.queue.pending} />
              <MetricsCard label="실행중" value={monitor.queue.running} />
              <MetricsCard label="완료" value={monitor.queue.completed} />
              <MetricsCard label="실패" value={monitor.queue.failed} />
              <MetricsCard label="실패율" value={`${monitor.failureRate}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="text-sm font-semibold text-neutral-200 mb-3">상태별 제출</h3>
                <div className="space-y-2 text-sm">
                  {monitor.statuses.slice(0, 4).map((row) => (
                    <div key={row.status} className="flex justify-between text-neutral-400">
                      <span>{row.status}</span>
                      <span className="font-mono font-semibold text-neutral-100">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="text-sm font-semibold text-neutral-200 mb-3">언어별 제출</h3>
                <div className="space-y-2 text-sm">
                  {monitor.languages.slice(0, 4).map((row) => (
                    <div key={row.language} className="flex justify-between text-neutral-400">
                      <span className="uppercase">{row.language}</span>
                      <span className="font-mono font-semibold text-neutral-100">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="problem-create" className="mb-8">
            <h2 className="text-lg font-bold text-neutral-100 mb-4">문제 관리</h2>
            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-6">
              <AdminProblemForm initialAllowedLanguages={allowedLanguages} />
            </div>
          </section>

          <AdminContestsPanel />
        </div>
      </main>
    </div>
  );
}

function MetricsCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 hover:bg-neutral-800 transition">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-2xl font-bold text-neutral-100 mt-2">{value}</div>
    </div>
  );
}
