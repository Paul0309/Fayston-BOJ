"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ThemeToggle from "../../components/ThemeToggle";
import Icon from "../../components/Icon";
import ProblemSidebar from "../../contest/components/ProblemSidebar";
import EditorArea from "../../contest/components/EditorArea";
import { LANG_LABELS, normalizeOutput } from "../../../lib/contest";
import { makePastPracticeContest } from "../../../lib/pastCompetitions";

async function runCompiler(code, input, language) {
  const res = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, input, language }),
  });
  const data = await res.json();
  if (!res.ok) {
    const type = data.errorType ? String(data.errorType).toUpperCase() : "ERROR";
    const stderr = data.details?.stderr ? `\n${data.details.stderr.trim()}` : "";
    throw new Error(`${type}: ${data.error || "Compile failed"}${stderr}`);
  }
  return normalizeOutput(data.output);
}

export default function PastContestPracticePage() {
  const routeParams = useParams();
  const router = useRouter();
  const [contest, setContest] = useState(null);
  const [output, setOutput] = useState({ text: "", status: "idle" });
  const [runBusy, setRunBusy] = useState(false);
  const [busyQ, setBusyQ] = useState("");

  const contestId = Array.isArray(routeParams?.contestId)
    ? routeParams.contestId[0]
    : routeParams?.contestId;

  useEffect(() => {
    if (!contestId) return;
    const c = makePastPracticeContest(contestId);
    if (!c) {
      router.replace("/past-competitions");
      return;
    }
    const query = new URLSearchParams(window.location.search);
    const q = query.get("q");
    if (q && c.questions.some((item) => item.id === q)) {
      c.selectedId = q;
    }
    setContest(c);
  }, [contestId, router]);

  const selQ = useMemo(
    () => (contest ? contest.questions.find((q) => q.id === contest.selectedId) || contest.questions[0] : null),
    [contest]
  );

  const patchQ = (id, patch) => {
    setContest((prev) =>
      !prev
        ? prev
        : { ...prev, questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }
    );
  };

  const setSelId = (id) => setContest((prev) => (prev ? { ...prev, selectedId: id } : prev));

  const handleRun = async () => {
    if (!selQ || runBusy) return;
    setRunBusy(true);
    setOutput({ text: "Running…", status: "running" });
    try {
      const input = typeof selQ.runInput === "string" ? selQ.runInput : selQ.sampleInput;
      const out = await runCompiler(selQ.code, input, selQ.language);
      setOutput({ text: out || "(empty)", status: "ok" });
    } catch (e) {
      setOutput({ text: e.message, status: "err" });
    } finally {
      setRunBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!selQ) return;
    const lang = selQ.language;
    const langLabel = LANG_LABELS[lang];
    setBusyQ(selQ.id);
    setOutput({ text: "Judging…", status: "running" });
    try {
      const logs = Array.isArray(selQ.submissionLogs) ? selQ.submissionLogs : [];
      const total = selQ.tests.length;
      let passed = 0;
      let failDetail = "";

      for (let i = 0; i < total; i++) {
        const t = selQ.tests[i];
        const out = await runCompiler(selQ.code, t.input, lang);
        if (normalizeOutput(out) === normalizeOutput(t.output)) {
          passed++;
          setOutput({ text: `[${langLabel}] Running… ${i + 1}/${total} ✓`, status: "running" });
        } else {
          failDetail = `Wrong Answer on test #${i + 1} — expected "${normalizeOutput(t.output)}", got "${normalizeOutput(out)}"`;
          break;
        }
      }

      const score = Math.floor((passed / total) * 100);
      const verdict = score === 100 ? "Accepted" : "Wrong Answer";
      const logLine =
        score === 100
          ? `✓ [${langLabel}] ${verdict} — ${passed}/${total} tests — ${score}/100`
          : `✗ [${langLabel}] ${verdict} — ${passed}/${total} tests — ${score}/100 | ${failDetail}`;

      patchQ(selQ.id, { submitted: true, score, status: verdict, submissionLogs: [...logs, logLine] });
      setOutput({
        text:
          score === 100
            ? `✓ All ${total} tests passed  [${langLabel}]  Score: 100/100`
            : `✗ ${passed}/${total} tests passed  [${langLabel}]  Score: ${score}/100\n\n${failDetail}`,
        status: score === 100 ? "ok" : "err",
      });
    } catch (e) {
      const logs = Array.isArray(selQ.submissionLogs) ? selQ.submissionLogs : [];
      const msg = e instanceof Error ? e.message : "Error";
      const errorType = msg.startsWith("COMPILE") ? "Compile Error" : msg.startsWith("RUNTIME") ? "Runtime Error" : "Error";
      const langLabel = LANG_LABELS[selQ.language];
      const logLine = `✗ [${langLabel}] ${errorType} — 0/${selQ.tests.length} tests — 0/100 | ${msg}`;
      patchQ(selQ.id, { submitted: true, score: 0, status: errorType, submissionLogs: [...logs, logLine] });
      setOutput({ text: `[${langLabel}] ${msg}`, status: "err" });
    } finally {
      setBusyQ("");
    }
  };

  if (!contest || !selQ) return null;

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo">&lt;/&gt; USACO School</Link>
          <div className="nav-links">
            <span className="nav-link" style={{ cursor: "default", opacity: 0.7 }}>
              Past Practice · {contest.division}
            </span>
            <Link href="/past-competitions" className="nav-link">
              <Icon name="archive" className="icon" /> All Past Competitions
            </Link>
          </div>
          <div className="nav-right">
            <ThemeToggle />
            <Link href="/past-competitions" className="btn btn-outline" style={{ fontSize: "0.82rem", padding: "0.35rem 0.7rem" }}>
              <Icon name="back" className="icon" /> Back
            </Link>
          </div>
        </div>
      </nav>

      <div className="past-practice-head">
        <h2>{contest.title}</h2>
        <p>Interactive practice mode for every problem in this contest.</p>
      </div>

      <div className="contest-wrap">
        <ProblemSidebar contest={contest} selQ={selQ} setSelId={setSelId} />
        <EditorArea
          selQ={selQ}
          patchQ={patchQ}
          output={output}
          timerEnd={false}
          runBusy={runBusy}
          busyQ={busyQ}
          timeLeft={0}
          hydrated={true}
          handleRun={handleRun}
          handleSubmit={handleSubmit}
          showTimer={false}
        />
      </div>
    </>
  );
}
