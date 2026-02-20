import Link from "next/link";
import { USACO_DIVISIONS } from "@/lib/usaco/problem-bank";

const DIV_META: Record<string, { sub: string; cls: string }> = {
  Bronze: { sub: "Start here", cls: "bronze" },
  Silver: { sub: "Prefix sums, sets", cls: "silver" },
  Gold: { sub: "DP, graphs", cls: "gold" },
  Platinum: { sub: "Advanced algorithms", cls: "platinum" }
};

export default function UsacoTrackPage() {
  return (
    <div className="usaco-home">
      <section className="usaco-hero">
        <div className="usaco-hero-left">
          <p className="usaco-hero-badge">Competitive Programming</p>
          <h1 className="usaco-hero-title">The judge<br /><span>never lies.</span></h1>
          <p className="usaco-hero-desc">
            One 30-minute contest. Three problems. You need 100/100 on every problem to promote.
          </p>
          <Link href="/usaco/contest" className="usaco-hero-cta">
            Start Contest
          </Link>
        </div>

        <div className="usaco-terminal">
          <div className="usaco-terminal-head">
            <span />
            <span />
            <span />
            <em>usaco-judge - bash</em>
          </div>
                    <pre>
            <span className="usaco-term-line cmd">$ submit --lang=cpp17 --problem=b1</span>
            <span className="usaco-term-line ok">✓ Compiled successfully</span>
            <span className="usaco-term-line ok">✓ Test 1/3 passed (0.012s)</span>
            <span className="usaco-term-line ok">✓ Test 2/3 passed (0.009s)</span>
            <span className="usaco-term-line ok">✓ Test 3/3 passed (0.011s)</span>
            <span className="usaco-term-line score">Score: 100 / 100 ---------------- Accepted</span>
            <span className="usaco-term-line promo">Promoted: Bronze -&gt; Silver</span>
          </pre>
        </div>
      </section>

      <section className="usaco-division-strip">
        <h2>Division Ladder</h2>
        <div className="usaco-division-track">
          {USACO_DIVISIONS.map((division) => (
            <div key={division} className="usaco-division-node">
              <div className={`usaco-division-badge ${DIV_META[division].cls}`}>{division}</div>
              <div className="usaco-division-sub">{DIV_META[division].sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="usaco-feature-grid">
        <article>
          <h3>Local Compiler</h3>
          <p>Code runs on your infrastructure with strict limits and deterministic judging.</p>
        </article>
        <article>
          <h3>Monaco Editor</h3>
          <p>VS Code editor experience with line guides, syntax, and language switching.</p>
        </article>
        <article>
          <h3>Strict Judging</h3>
          <p>Hidden tests, exact output matching, and score split by testcase groups.</p>
        </article>
      </section>

      <section className="usaco-archive">
        <h2>Past Competitions</h2>
        <p>Browse archived division sets with statements, data, and notes.</p>
        <Link href="/usaco/past-competitions" className="usaco-archive-btn">
          Open Archive
        </Link>
      </section>

      <section className="usaco-rules">
        <h2>How it works</h2>
        <ul>
          <li>Register and start from Bronze division.</li>
          <li>Each contest gives 3 problems and a 30-minute timer.</li>
          <li>Run for samples, Submit for full hidden tests.</li>
          <li>Need 100/100 on all 3 to promote.</li>
        </ul>
      </section>
    </div>
  );
}

