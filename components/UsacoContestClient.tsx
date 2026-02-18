"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { Clock3, Microchip, Plus } from "lucide-react";
import type { SupportedLanguage } from "@/lib/languages";
import { LANGUAGE_META } from "@/lib/languages";

type ContestProblem = {
  id: string;
  number: number;
  title: string;
  difficulty: string;
  tags: string;
  description: string;
  inputDesc: string | null;
  outputDesc: string | null;
  timeLimit: number;
  memoryLimit: number;
  firstSampleInput?: string;
  firstSampleOutput?: string;
  scoringGuide: string[];
};

type LatestStatus = {
  id: string;
  status: string;
  totalScore: number | null;
  maxScore: number | null;
  language: string;
  detail: string;
  failedCase: number | null;
  expectedOutput: string | null;
  actualOutput: string | null;
  updatedAt: string;
  passedTests: number;
  totalTests: number;
};

type CodeFile = {
  id: string;
  name: string;
  language: SupportedLanguage;
  code: string;
};

type PerProblemState = {
  files: CodeFile[];
  activeFileId: string | null;
  runInput: string;
};

interface UsacoContestClientProps {
  division: string;
  userId: string;
  allowedLanguages: SupportedLanguage[];
  problems: ContestProblem[];
  initialStatuses: Record<string, LatestStatus | undefined>;
  initialLogsByProblem: Record<string, LatestStatus[]>;
}

const CONTEST_MS = 30 * 60 * 1000;

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "cpp",
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  java: "java"
};

function displayTitle(raw: string) {
  return raw.replace(/^\[USACO\s+[^\]]+\]\s*/i, "").trim();
}

function extractDisplayTags(raw: string) {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((tag) => !tag.startsWith("usaco") && !tag.startsWith("division:"));
}

function formatDifficulty(raw: string) {
  return raw.split("_")[0] || raw;
}

function extensionOf(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

function languageFromFilename(name: string): SupportedLanguage | null {
  const ext = extensionOf(name);
  return EXTENSION_TO_LANGUAGE[ext] || null;
}

function getInitialContestState(division: string, userId: string, problems: ContestProblem[]) {
  const fallback = { startAt: Date.now(), selectedId: problems[0]?.id || "" };
  if (typeof window === "undefined") return fallback;
  const key = `usaco-contest:${division}:${userId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { startAt?: number; selectedId?: string };
    return {
      startAt: typeof parsed.startAt === "number" ? parsed.startAt : fallback.startAt,
      selectedId:
        typeof parsed.selectedId === "string" && problems.some((p) => p.id === parsed.selectedId)
          ? parsed.selectedId
          : fallback.selectedId
    };
  } catch {
    return fallback;
  }
}

function formatRemaining(ms: number) {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function buildScoreLine(entry?: LatestStatus) {
  if (!entry) return "";
  const lang = LANGUAGE_META[entry.language as SupportedLanguage]?.label || entry.language;
  const total = entry.totalTests || 0;
  const passed = Math.min(entry.passedTests || 0, total);
  const score = `${entry.totalScore ?? 0}/${entry.maxScore ?? 100}`;
  const prefix = entry.status === "ACCEPTED" ? "OK" : entry.status === "PENDING" ? "..." : "X";
  return `${prefix} ${passed}/${total} tests passed [${lang}] Score: ${score}`;
}

function buildFailureLine(entry?: LatestStatus) {
  if (!entry || entry.status === "ACCEPTED" || entry.status === "PENDING") return "";
  if (entry.failedCase && entry.expectedOutput !== null && entry.actualOutput !== null) {
    return `Wrong Answer on test #${entry.failedCase} - expected "${entry.expectedOutput}", got "${entry.actualOutput}"`;
  }
  if (entry.failedCase) return `Failed on test #${entry.failedCase}`;
  return entry.detail || entry.status;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <button type="button" className="usaco-copy-btn" onClick={onCopy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function UsacoContestClient({
  division,
  userId,
  allowedLanguages,
  problems,
  initialStatuses,
  initialLogsByProblem
}: UsacoContestClientProps) {
  const initial = getInitialContestState(division, userId, problems);

  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [startAt, setStartAt] = useState<number>(initial.startAt);
  const [remainingMs, setRemainingMs] = useState<number>(CONTEST_MS);
  const [statuses, setStatuses] = useState<Record<string, LatestStatus | undefined>>(initialStatuses);
  const [logsByProblem, setLogsByProblem] = useState<Record<string, LatestStatus[]>>(initialLogsByProblem);
  const [states, setStates] = useState<Record<string, PerProblemState>>(() =>
    Object.fromEntries(
      problems.map((p) => [
        p.id,
        {
          files: [],
          activeFileId: null,
          runInput: p.firstSampleInput || ""
        }
      ])
    )
  );
  const [runBusy, setRunBusy] = useState(false);
  const [runStatus, setRunStatus] = useState("-");
  const [runStdout, setRunStdout] = useState("");
  const [runStderr, setRunStderr] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [outputMode, setOutputMode] = useState<"run" | "judge">("run");
  const [fileCreatorOpen, setFileCreatorOpen] = useState(false);
  const [fileCreatorName, setFileCreatorName] = useState("");
  const [fileCreatorError, setFileCreatorError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const storageKey = useMemo(() => `usaco-contest:${division}:${userId}`, [division, userId]);
  const selected = useMemo(() => problems.find((p) => p.id === selectedId) || problems[0], [problems, selectedId]);
  const selectedState = selected ? states[selected.id] : undefined;
  const activeFile = useMemo(() => {
    if (!selectedState?.activeFileId) return null;
    return selectedState.files.find((f) => f.id === selectedState.activeFileId) || null;
  }, [selectedState]);
  const selectedLatest = selected ? statuses[selected.id] : undefined;
  const selectedLogs = selected ? logsByProblem[selected.id] || [] : [];
  const isEnded = remainingMs <= 0;
  const isJudgePending = selectedLatest?.status === "PENDING";

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ startAt, selectedId }));
  }, [storageKey, startAt, selectedId]);

  useEffect(() => {
    setFileCreatorOpen(false);
    setFileCreatorName("");
    setFileCreatorError("");
  }, [selectedId]);

  useEffect(() => {
    if (fileCreatorOpen) {
      const timer = setTimeout(() => fileInputRef.current?.focus(), 10);
      return () => clearTimeout(timer);
    }
  }, [fileCreatorOpen]);

  useEffect(() => {
    const elapsed = Date.now() - startAt;
    if (elapsed >= CONTEST_MS) {
      setStartAt(Date.now());
    }
  }, [startAt]);

  useEffect(() => {
    const tick = () => setRemainingMs(CONTEST_MS - (Date.now() - startAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startAt]);

  useEffect(() => {
    if (problems.length === 0) return;
    let alive = true;
    const ids = problems.map((p) => p.id).join(",");
    const load = async () => {
      try {
        const res = await fetch(`/api/usaco/contest/progress?problemIds=${encodeURIComponent(ids)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setStatuses(data.statuses || {});
        setLogsByProblem(data.logsByProblem || {});
      } catch {
        // ignore polling errors
      }
    };
    void load();
    const poll = setInterval(load, 2500);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [problems]);

  useEffect(() => {
    const onSaveHotkey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onSaveHotkey);
    return () => window.removeEventListener("keydown", onSaveHotkey);
  }, []);

  const patchSelected = (patch: Partial<PerProblemState>) => {
    if (!selected) return;
    setStates((prev) => ({
      ...prev,
      [selected.id]: { ...prev[selected.id], ...patch }
    }));
  };

  const updateActiveFileCode = (code: string) => {
    if (!selected || !selectedState || !selectedState.activeFileId) return;
    const activeId = selectedState.activeFileId;
    patchSelected({
      files: selectedState.files.map((file) => (file.id === activeId ? { ...file, code } : file))
    });
  };

  const createFileWithName = (rawName: string) => {
    if (!selected || !selectedState) return;
    const name = rawName.trim();
    if (!name) {
      setFileCreatorError("Enter a file name.");
      return;
    }
    const language = languageFromFilename(name);
    if (!language) {
      setFileCreatorError("Unsupported extension. Use .py, .cpp, .cc, .cxx, .c, .js, .mjs, .cjs, .java");
      return;
    }
    if (!allowedLanguages.includes(language)) {
      setFileCreatorError(`Language disabled: ${LANGUAGE_META[language].label}`);
      return;
    }
    if (selectedState.files.some((file) => file.name.toLowerCase() === name.toLowerCase())) {
      setFileCreatorError("A file with the same name already exists.");
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: CodeFile = {
      id,
      name,
      language,
      code: LANGUAGE_META[language].defaultCode
    };
    patchSelected({
      files: [...selectedState.files, next],
      activeFileId: id
    });
    setFileCreatorOpen(false);
    setFileCreatorName("");
    setFileCreatorError("");
  };

  const openFileCreator = () => {
    setFileCreatorOpen(true);
    setFileCreatorError("");
  };

  const submitFileCreator = () => {
    createFileWithName(fileCreatorName);
  };

  const handleRun = async () => {
    if (!selected || !selectedState || !activeFile || runBusy || submitBusy || isEnded) return;
    setOutputMode("run");
    setRunBusy(true);
    setRunStatus("RUNNING");
    setRunStdout("");
    setRunStderr("");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: selected.id,
          code: activeFile.code,
          language: activeFile.language,
          input: selectedState.runInput
        })
      });
      if (!res.ok) {
        setRunStatus("ERROR");
        setRunStderr(await res.text());
        return;
      }
      const data = (await res.json()) as { status?: string; stdout?: string; stderr?: string };
      setRunStatus(data.status || "DONE");
      setRunStdout(data.stdout || "");
      setRunStderr(data.stderr || "");
    } catch (error) {
      setRunStatus("ERROR");
      setRunStderr(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setRunBusy(false);
    }
  };

  const refreshProgress = async () => {
    const ids = problems.map((p) => p.id).join(",");
    const progressRes = await fetch(`/api/usaco/contest/progress?problemIds=${encodeURIComponent(ids)}`, { cache: "no-store" });
    if (!progressRes.ok) return;
    const data = await progressRes.json();
    setStatuses(data.statuses || {});
    setLogsByProblem(data.logsByProblem || {});
  };

  const handleSubmit = async () => {
    if (!selected || !activeFile || submitBusy || runBusy || isEnded) return;
    setOutputMode("judge");
    setSubmitBusy(true);
    try {
      const res = await fetch("/api/usaco/contest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: selected.id,
          code: activeFile.code,
          language: activeFile.language
        })
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      await refreshProgress();
    } catch {
      alert("Submit failed.");
    } finally {
      setSubmitBusy(false);
    }
  };

  if (problems.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-5 text-amber-100">
        No imported USACO problems for this division.
      </div>
    );
  }

  const outputStatus: "idle" | "running" | "ok" | "err" = (() => {
    if (outputMode === "run") {
      if (runBusy || runStatus === "RUNNING") return "running";
      if (runStderr) return "err";
      if (runStdout) return "ok";
      return "idle";
    }
    if (submitBusy || isJudgePending) return "running";
    if (selectedLatest?.status === "ACCEPTED") return "ok";
    if (selectedLatest) return "err";
    return "idle";
  })();

  const outputText = (() => {
    if (outputMode === "run") return runStderr || runStdout || "Code has not been run yet.";
    if (!selectedLatest) return "No submission yet.";
    if (submitBusy || isJudgePending) return selectedLatest.detail || "Judging...";
    const topLine = buildScoreLine(selectedLatest);
    const failLine = buildFailureLine(selectedLatest);
    return failLine ? `${topLine}\n\n${failLine}` : topLine;
  })();

  return (
    <div className="usaco-contest-root">
      <div className="usaco-contest-main">
        <aside className="usaco-contest-sidebar">
          <div className="usaco-q-tabs">
            {problems.map((problem, idx) => {
              const active = selected?.id === problem.id;
              return (
                <button key={problem.id} type="button" className={`usaco-q-tab ${active ? "active" : ""}`} onClick={() => setSelectedId(problem.id)}>
                  Q{idx + 1}
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="usaco-problem-scroll">
              <h2 className="usaco-problem-title">{displayTitle(selected.title)}</h2>
              <div className="usaco-problem-meta">
                <span>{formatDifficulty(selected.difficulty)}</span>
                <span>
                  <Clock3 size={12} /> {selected.timeLimit}ms
                </span>
                <span>
                  <Microchip size={12} /> {selected.memoryLimit}MB
                </span>
              </div>
              <div className="usaco-tag-row">
                {extractDisplayTags(selected.tags).map((tag) => (
                  <span key={tag} className="usaco-tag-pill">
                    {tag}
                  </span>
                ))}
              </div>

              <section>
                <h3>Problem</h3>
                <p>{selected.description}</p>
              </section>
              <section>
                <h3>Input</h3>
                <p>{selected.inputDesc || "-"}</p>
              </section>
              <section>
                <h3>Output</h3>
                <p>{selected.outputDesc || "-"}</p>
              </section>

              <section>
                <h3>Example</h3>
                <div className="usaco-io-box">
                  <div className="usaco-io-head">
                    <span>Sample Input</span>
                    <CopyButton value={selected.firstSampleInput || ""} />
                  </div>
                  <pre>{selected.firstSampleInput || "-"}</pre>
                </div>
                <div className="usaco-io-box">
                  <div className="usaco-io-head">
                    <span>Sample Output</span>
                    <CopyButton value={selected.firstSampleOutput || ""} />
                  </div>
                  <pre>{selected.firstSampleOutput || "-"}</pre>
                </div>
              </section>

              <section>
                <h3>Scoring</h3>
                <ul className="usaco-scoring-list">
                  {selected.scoringGuide.map((line, idx) => (
                    <li key={`${selected.id}-score-${idx}`}>{line}</li>
                  ))}
                </ul>
              </section>

              {selectedLogs.length > 0 ? (
                <section>
                  <h3>Submissions</h3>
                  <div className="usaco-submission-log">
                    {selectedLogs.map((entry, idx) => {
                      const failLine = buildFailureLine(entry);
                      return (
                        <div key={entry.id} className={`usaco-submission-log-item ${entry.status === "ACCEPTED" ? "ok" : "err"}`}>
                          {idx + 1}. {buildScoreLine(entry)}
                          {failLine ? ` | ${failLine}` : ""}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </aside>

        <section className="usaco-editor-pane">
          <div className="usaco-editor-top">
            <div className="usaco-editor-tabs">
              {selectedState?.files.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={`usaco-file-tab ${selectedState.activeFileId === file.id ? "active" : ""}`}
                  onClick={() => patchSelected({ activeFileId: file.id })}
                >
                  {file.name}
                </button>
              ))}
              {fileCreatorOpen && (selectedState?.files.length || 0) > 0 ? (
                <div className="usaco-file-create-inline">
                  <input
                    ref={fileInputRef}
                    className="usaco-file-create-input"
                    placeholder="solution.py"
                    value={fileCreatorName}
                    onChange={(e) => {
                      setFileCreatorName(e.target.value);
                      if (fileCreatorError) setFileCreatorError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitFileCreator();
                      } else if (e.key === "Escape") {
                        setFileCreatorOpen(false);
                        setFileCreatorName("");
                        setFileCreatorError("");
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
            <button type="button" className="usaco-new-file-btn" onClick={openFileCreator}>
              <Plus className="w-4 h-4" />
              <span>New File</span>
            </button>
          </div>

          <div className="usaco-editor-wrap">
            {activeFile ? (
              <Editor
                height="100%"
                language={LANGUAGE_META[activeFile.language].monaco}
                theme="vs-dark"
                value={activeFile.code}
                onChange={(value) => updateActiveFileCode(value || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                  lineHeight: 22,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  guides: { indentation: true, bracketPairs: true }
                }}
              />
            ) : (
              <div className="usaco-editor-empty">
                <div className="usaco-editor-empty-card">
                  <h4>No source file yet</h4>
                  <p>Create a file with extension like `.py`, `.cpp`, `.java`, `.js`.</p>
                  {!fileCreatorOpen ? (
                    <button type="button" className="usaco-new-file-btn" onClick={openFileCreator}>
                      <Plus className="w-4 h-4" />
                      <span>Create First File</span>
                    </button>
                  ) : (
                    <div className="usaco-file-create-panel">
                      <input
                        ref={fileInputRef}
                        className="usaco-file-create-input"
                        placeholder="solution.py"
                        value={fileCreatorName}
                        onChange={(e) => {
                          setFileCreatorName(e.target.value);
                          if (fileCreatorError) setFileCreatorError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitFileCreator();
                          } else if (e.key === "Escape") {
                            setFileCreatorOpen(false);
                            setFileCreatorName("");
                            setFileCreatorError("");
                          }
                        }}
                      />
                      <button type="button" className="usaco-new-file-btn" onClick={submitFileCreator}>
                        Create
                      </button>
                    </div>
                  )}
                  {fileCreatorError ? <p className="usaco-file-create-error">{fileCreatorError}</p> : null}
                </div>
              </div>
            )}
          </div>

          <div className="usaco-run-input-wrap">
            <div className="usaco-run-input-head">Custom Input For Run</div>
            <textarea
              className="usaco-run-input"
              value={selectedState?.runInput || ""}
              onChange={(e) => patchSelected({ runInput: e.target.value })}
              disabled={isEnded}
            />
          </div>

          <div className="usaco-output-wrap">
            <div className={`usaco-output-head ${outputStatus}`}>
              <span className={`usaco-output-dot ${outputStatus}`} />
              OUTPUT
            </div>
            <pre className={`usaco-output-body ${outputStatus}`}>{outputText}</pre>
          </div>

          <div className="usaco-action-bar">
            <select className="usaco-lang-select" value={activeFile?.language || ""} disabled>
              <option value="">{activeFile ? "Auto" : "Create file first"}</option>
              {allowedLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_META[lang].label}
                </option>
              ))}
            </select>

            <button type="button" className="usaco-run-btn" onClick={handleRun} disabled={!activeFile || runBusy || submitBusy || isEnded}>
              {runBusy ? "Running..." : "Run"}
            </button>
            <button type="button" className="usaco-submit-btn" onClick={handleSubmit} disabled={!activeFile || submitBusy || runBusy || isEnded}>
              {submitBusy ? "Submitting..." : "Submit"}
            </button>

            <div className="usaco-action-spacer" />
            <div className="usaco-score-mini">
              {selected ? `${statuses[selected.id]?.status || "PENDING"} ${statuses[selected.id]?.totalScore ?? 0}/${statuses[selected.id]?.maxScore ?? 100}` : "-"}
            </div>
            <div className={`usaco-timer ${isEnded ? "danger" : ""}`}>{isEnded ? "TIME UP" : formatRemaining(remainingMs)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
