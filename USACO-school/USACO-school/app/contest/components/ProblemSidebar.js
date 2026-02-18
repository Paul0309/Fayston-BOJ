"use client";

import CopyButton from "./CopyButton";
import Icon from "../../components/Icon";

function getScoringData(problem) {
  const fallbackGuide = [
    "Inputs 1-2: Small constraints.",
    "Inputs 3-4: Medium constraints.",
    "Inputs 5+: Full constraints.",
  ];

  const guide = Array.isArray(problem.scoringGuide) && problem.scoringGuide.length > 0
    ? problem.scoringGuide
    : fallbackGuide;

  return { guide };
}

// ─── Left sidebar: problem tabs, statement, I/O examples, submission log ───────
export default function ProblemSidebar({ contest, selQ, setSelId }) {
  const { guide } = getScoringData(selQ);

  return (
    <aside className="contest-sidebar">

      {/* Problem selector tabs */}
      <div className="sidebar-tabs">
        {contest.questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            className={[
              "sidebar-tab",
              contest.selectedId === q.id ? "active" : "",
              q.score === 100 ? "solved" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => setSelId(q.id)}
            title={q.title}
          >
            Q{i + 1}{q.score === 100 ? " Done" : q.submitted ? ` ${q.score}` : ""}
          </button>
        ))}
      </div>

      {/* Scrollable problem content */}
      <div className="sidebar-body">
        <h2 className="prob-title">{selQ.title}</h2>

        {/* Metadata row: difficulty, limits, tags */}
        <div className="prob-meta">
          <div className="prob-meta-item"><strong>{selQ.difficulty}</strong></div>
          <div className="prob-meta-item"><Icon name="clock" className="icon" /> <strong>1000ms</strong></div>
          <div className="prob-meta-item"><Icon name="memory" className="icon" /> <strong>128MB</strong></div>
          {(selQ.tags ?? []).map((t) => (
            <span key={t} className="tag-pill">{t}</span>
          ))}
        </div>

        {/* Problem statement */}
        <div className="prob-section">
          <h4>Problem</h4>
          <p>{selQ.statement}</p>
        </div>

        <div className="prob-section">
          <h4>Input</h4>
          <p>{selQ.inputDesc}</p>
        </div>

        <div className="prob-section">
          <h4>Output</h4>
          <p>{selQ.outputDesc}</p>
        </div>

        {/* Sample I/O with copy buttons */}
        <div className="prob-section">
          <h4>Example</h4>
          <div className="io-example" style={{ marginBottom: "0.5rem" }}>
            <div className="io-example-header">
              <span>Sample Input</span>
              <CopyButton text={selQ.sampleInput} />
            </div>
            <pre>{selQ.sampleInput}</pre>
          </div>
          <div className="io-example">
            <div className="io-example-header">
              <span>Sample Output</span>
              <CopyButton text={selQ.sampleOutput} />
            </div>
            <pre>{selQ.sampleOutput}</pre>
          </div>
        </div>

        {/* Scoring guide + matched scoring tests */}
        <div className="prob-section">
          <h4>Scoring</h4>
          <ul className="prob-scoring-list">
            {guide.map((line, idx) => (
              <li key={`guide-${idx}`}>{line}</li>
            ))}
          </ul>
        </div>

        {/* Submission log (shows after first submit) */}
        {(selQ.submissionLogs ?? []).length > 0 && (
          <div className="prob-section">
            <h4>Submissions</h4>
            <div className="sub-log">
              {(selQ.submissionLogs ?? []).map((entry, i) => (
                <div
                  key={i}
                  className={`sub-log-entry${entry.startsWith("✓") ? " pass" : " fail"}`}
                >
                  {i + 1}. {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
