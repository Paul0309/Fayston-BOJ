import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownMath from "@/components/MarkdownMath";
import { USACO_DIVISIONS, USACO_QUESTION_BANK, type UsacoDivision } from "@/lib/usaco/problem-bank";

interface PageProps {
  params: Promise<{ division: string; problemId: string }>;
}

function isDivision(value: string): value is UsacoDivision {
  return USACO_DIVISIONS.includes(value as UsacoDivision);
}

export default async function UsacoProblemDetailPage(props: PageProps) {
  const { division, problemId } = await props.params;
  if (!isDivision(division)) return notFound();

  const problem = USACO_QUESTION_BANK[division].find((p) => p.id === problemId);
  if (!problem) return notFound();

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-8">
      <div className="border-b border-neutral-700 pb-4">
        <h1 className="text-3xl font-bold text-neutral-100">{problem.title}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-300">
          <span>Track: USACO {division}</span>
          <span>Difficulty: {problem.difficulty}</span>
          <span>Tags: {problem.tags.join(", ")}</span>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-neutral-100 mb-2">Statement</h2>
        <MarkdownMath className="prose prose-invert max-w-none text-neutral-100" statementMode content={problem.statement} />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-neutral-100 mb-2">Input</h2>
        <MarkdownMath className="prose prose-invert max-w-none text-neutral-100" statementMode content={problem.inputDesc} />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-neutral-100 mb-2">Output</h2>
        <MarkdownMath className="prose prose-invert max-w-none text-neutral-100" statementMode content={problem.outputDesc} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <h3 className="font-semibold text-neutral-100 mb-2">Sample Input</h3>
          <pre className="boj-code-font whitespace-pre-wrap text-sm text-neutral-200">{problem.sampleInput}</pre>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <h3 className="font-semibold text-neutral-100 mb-2">Sample Output</h3>
          <pre className="boj-code-font whitespace-pre-wrap text-sm text-neutral-200">{problem.sampleOutput}</pre>
        </div>
      </section>

      <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-4 text-sm text-blue-100">
        이 트랙 문제를 실제 제출/채점에 사용하려면 관리자 패널에서 USACO Import를 먼저 실행하세요.
      </div>

      <div>
        <Link href="/usaco" className="text-blue-400 hover:underline">
          ← Back to USACO Track
        </Link>
        <Link href="/usaco/contest" className="ml-4 text-blue-400 hover:underline">
          Start My Division Contest
        </Link>
      </div>
    </div>
  );
}
