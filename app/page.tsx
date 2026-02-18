import Link from "next/link";
import { ArrowRight, Code2, Trophy, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <section className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-neutral-900 to-neutral-950">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-100">
            우리 학교만의 <br />
            <span className="text-blue-500">알고리즘 대회 플랫폼</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-200">
            SchoolBOJ에서 프로그래밍 실력을 키우고 친구들과 경쟁해보세요.<br />
            실시간 채점, 랭킹, 다양한 난이도의 문제가 준비되어 있습니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/problems"
              className={cn(
                "inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-lg font-bold transition-all",
                "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5"
              )}
            >
              문제 풀러 가기
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/rank"
              className={cn(
                "inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-lg font-bold transition-all",
                "bg-neutral-800 text-neutral-100 border border-neutral-700 hover:bg-neutral-700 hover:shadow-md"
              )}
            >
              랭킹 확인하기
              <Trophy className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-neutral-900 border-t border-neutral-800">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Code2 className="w-8 h-8 text-blue-500" />}
              title="다양한 문제"
              description="기초부터 심화까지, 다양한 난이도의 알고리즘 문제를 풀어보세요."
            />
            <FeatureCard
              icon={<Timer className="w-8 h-8 text-blue-500" />}
              title="실시간 채점"
              description="제출 즉시 코드를 채점하고 결과를 확인하세요."
            />
            <FeatureCard
              icon={<Trophy className="w-8 h-8 text-blue-500" />}
              title="학교 랭킹"
              description="문제를 풀고 순위를 올려 학교 랭킹 1위에 도전하세요."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-neutral-800 border border-neutral-700">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2 text-neutral-100">{title}</h3>
      <p className="text-neutral-200 leading-relaxed">{description}</p>
    </div>
  );
}
