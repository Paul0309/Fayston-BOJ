"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  CODE_TEMPLATES,
  LANGUAGES,
  LANG_LABELS,
  LANG_EXT,
  LANG_ICON,
  MONACO_LANG,
  formatTime,
} from "../../../lib/contest";
import Icon from "../../components/Icon";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ─── Right panel: file tab, Monaco editor, output strip, action bar ───────────
export default function EditorArea({
  selQ,
  patchQ,
  output,
  timerEnd,
  runBusy,
  busyQ,
  timeLeft,
  hydrated,
  handleRun,
  handleSubmit,
  showTimer = true,
}) {
  // Monaco theme tracks the page's data-theme attribute
  const [editorTheme, setEditorTheme] = useState("vs-dark");

  useEffect(() => {
    const applyTheme = () => {
      const t = document.documentElement.getAttribute("data-theme") || "dark";
      setEditorTheme(t === "light" ? "vs" : "vs-dark");
    };
    applyTheme();
    const obs = new MutationObserver(applyTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const isSubmitting = busyQ === selQ.id;
  const isPerfect = selQ.score === 100;

  return (
    <div className="contest-editor-area">

      {/* File tab showing language icon + filename */}
      <div className="file-tabs-bar">
        <div className="file-tab active">
          <span className="file-tab-icon">{LANG_ICON[selQ.language]}</span>
          {LANG_EXT[selQ.language]}
        </div>
      </div>

      {/* Monaco editor */}
      <div className="editor-wrap">
        <MonacoEditor
          height="100%"
          language={MONACO_LANG[selQ.language]}
          value={selQ.code}
          theme={editorTheme}
          onChange={(v) => patchQ(selQ.id, { code: typeof v === "string" ? v : "" })}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbersMinChars: 3,
            padding: { top: 10, bottom: 10 },
            fontFamily: '"Cascadia Code","Fira Code","Consolas",monospace',
            fontLigatures: true,
          }}
        />
      </div>

      <div className="custom-input-wrap">
        <div className="custom-input-head">Custom Input for Run</div>
        <textarea
          className="custom-input-box"
          value={typeof selQ.runInput === "string" ? selQ.runInput : ""}
          onChange={(e) => patchQ(selQ.id, { runInput: e.target.value })}
          placeholder="Type any input to test this problem..."
          disabled={timerEnd}
          spellCheck={false}
        />
      </div>

      {/* Output strip */}
      <div className="output-strip">
        <div className="output-strip-head">
          <div className={[
            "output-dot",
            output.status === "running" ? "running" : "",
            output.status === "ok" ? "ok" : "",
            output.status === "err" ? "err" : "",
          ].filter(Boolean).join(" ")} />
          Output
        </div>
        <div className="output-body">
          {output.text
            ? <span className={output.status === "err" ? "out-err" : output.status === "ok" ? "out-ok" : ""}>{output.text}</span>
            : <span className="out-dim">{"/* Code has not been run yet. */"}</span>
          }
        </div>
      </div>

      {/* Action bar: language selector | Run | Submit | score | timer */}
      <div className="action-bar">
        <select
          className="lang-select-sm"
          value={selQ.language}
          disabled={timerEnd}
          onChange={(e) => patchQ(selQ.id, { language: e.target.value, code: CODE_TEMPLATES[e.target.value] })}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{LANG_LABELS[l]}</option>
          ))}
        </select>

        <button
          type="button"
          className="btn-run"
          disabled={timerEnd || runBusy || isSubmitting}
          onClick={handleRun}
        >
          <Icon name="play" className="icon" /> Run
        </button>

        <button
          type="button"
          className="btn-judge"
          disabled={timerEnd || isSubmitting || runBusy}
          onClick={handleSubmit}
        >
          <Icon name="submit" className="icon" /> Submit
        </button>

        <div className="action-spacer" />

        <div className="action-score-info">
          <span>Last score</span>
          <span className={`action-score-val${isPerfect ? " perfect" : ""}`}>
            {selQ.submitted ? `${selQ.score}/100` : "—"}
          </span>
        </div>

        {showTimer && (
          <div className={`contest-timer${timerEnd ? " danger" : ""}`}>
            {hydrated ? formatTime(timeLeft) : "30:00"}
          </div>
        )}
      </div>
    </div>
  );
}
