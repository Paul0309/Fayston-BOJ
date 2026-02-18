import Link from "next/link";
import { notFound } from "next/navigation";
import { getPastProblem } from "../../../../lib/pastCompetitions";

export default function PastProblemPage({ params }) {
  const { contestId, problemId } = params;
  const result = getPastProblem(contestId, problemId);
  if (!result) return notFound();

  const { contest, problem } = result;

  return (
    <main className="past-problem-wrap">
      <div className="past-problem-top">
        <p className="past-problem-breadcrumb">
          <Link href="/past-competitions">Past Competitions</Link> / {contest.title}
        </p>
        <h1>{problem.title}</h1>
      </div>

      <section className="past-problem-card">
        <h3>Problem</h3>
        <p>{problem.statement}</p>
      </section>

      <section className="past-problem-card">
        <h3>Input</h3>
        <p>{problem.inputDesc}</p>
      </section>

      <section className="past-problem-card">
        <h3>Output</h3>
        <p>{problem.outputDesc}</p>
      </section>

      <section className="past-problem-card" id="test-data">
        <h3>Test Data</h3>
        {(problem.testData || []).map((item, idx) => (
          <pre key={idx} className="past-problem-pre">{item}</pre>
        ))}
      </section>

      <section className="past-problem-card" id="solution">
        <h3>Solution Idea</h3>
        <p>{problem.solution}</p>
      </section>
    </main>
  );
}
