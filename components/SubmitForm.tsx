"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { DEFAULT_ALLOWED_LANGUAGES, LANGUAGE_META, type SupportedLanguage } from "@/lib/languages";
import type { CodeVisibility } from "@/lib/code-visibility";
import MarkdownMath from "@/components/MarkdownMath";

interface SubmitFormProps {
  problemId?: string | null;
  problemTitle?: string;
  problemDesc?: string;
  inputDesc?: string;
  outputDesc?: string;
  allowedLanguages?: SupportedLanguage[];
  initialRunInput?: string;
}

function getDraftKey(problemId: string | null | undefined, language: SupportedLanguage) {
  return `submit-draft:${problemId || "no-problem"}:${language}`;
}

export default function SubmitForm({
  problemId,
  problemTitle,
  problemDesc,
  inputDesc,
  outputDesc,
  allowedLanguages,
  initialRunInput
}: SubmitFormProps) {
  const router = useRouter();
  const completionRegisteredRef = useRef(false);
  const runEnabled = process.env.NEXT_PUBLIC_ENABLE_REMOTE_RUN !== "0";

  const languages = useMemo(() => {
    const source = allowedLanguages && allowedLanguages.length > 0 ? allowedLanguages : DEFAULT_ALLOWED_LANGUAGES;
    return source.filter((lang, index) => source.indexOf(lang) === index);
  }, [allowedLanguages]);

  const initialLanguage = languages[0] ?? "python";
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [code, setCode] = useState(LANGUAGE_META[initialLanguage].defaultCode);
  const [visibility, setVisibility] = useState<CodeVisibility>("PRIVATE");
  const [running, setRunning] = useState(false);
  const [runInput, setRunInput] = useState(initialRunInput || "");
  const [runStatus, setRunStatus] = useState<string>("-");
  const [runStdout, setRunStdout] = useState("");
  const [runStderr, setRunStderr] = useState("");
  const [runTimeMs, setRunTimeMs] = useState<number | null>(null);
  const [saveHint, setSaveHint] = useState("");

  const loadDraft = useCallback(
    (targetLanguage: SupportedLanguage) => {
      if (typeof window === "undefined") return false;
      try {
        const key = getDraftKey(problemId, targetLanguage);
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { code?: string; savedAt?: number };
        if (typeof parsed.code !== "string") return false;
        setCode(parsed.code);
        if (typeof parsed.savedAt === "number") {
          setSaveHint(`임시저장 불러옴 (${new Date(parsed.savedAt).toLocaleTimeString()})`);
        } else {
          setSaveHint("임시저장 불러옴");
        }
        return true;
      } catch {
        return false;
      }
    },
    [problemId]
  );

  const saveDraft = useCallback(
    (targetLanguage?: SupportedLanguage, targetCode?: string) => {
      if (typeof window === "undefined") return;
      const lang = targetLanguage ?? language;
      const content = targetCode ?? code;
      const savedAt = Date.now();
      localStorage.setItem(getDraftKey(problemId, lang), JSON.stringify({ code: content, savedAt }));
      setSaveHint(`임시저장됨 (${new Date(savedAt).toLocaleTimeString()})`);
    },
    [problemId, language, code]
  );

  useEffect(() => {
    const loaded = loadDraft(language);
    if (!loaded) {
      setCode(LANGUAGE_META[language].defaultCode);
      setSaveHint("");
    }
  }, [problemId, language, loadDraft]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveDraft]);

  const handleSubmit = async () => {
    if (!problemId) {
      alert("문제를 선택해주세요.");
      return;
    }
    if (languages.length === 0) {
      alert("현재 사용 가능한 언어가 없습니다.");
      return;
    }

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, code, language, codeVisibility: visibility })
      });

      if (res.ok) {
        router.push("/status");
      } else {
        alert("제출 실패: " + (await res.text()));
      }
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다.");
    }
  };

  const handleRun = async () => {
    if (!runEnabled) {
      setRunStatus("DISABLED");
      setRunStdout("");
      setRunStderr("Run is disabled in production. Use Submit for worker-based judging.");
      setRunTimeMs(null);
      return;
    }

    if (!problemId) {
      alert("문제를 선택해주세요.");
      return;
    }
    setRunning(true);
    setRunStatus("RUNNING");
    setRunStdout("");
    setRunStderr("");
    setRunTimeMs(null);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId,
          code,
          language,
          input: runInput
        })
      });

      if (!res.ok) {
        setRunStatus("ERROR");
        setRunStderr(await res.text());
        return;
      }

      const data = (await res.json()) as {
        ok: boolean;
        status: string;
        stdout: string;
        stderr: string;
        timeMs: number;
      };

      setRunStatus(data.status);
      setRunStdout(data.stdout || "");
      setRunStderr(data.stderr || "");
      setRunTimeMs(data.timeMs ?? null);
    } catch (error) {
      setRunStatus("ERROR");
      setRunStderr(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const handleEditorMount = (_editor: unknown, monaco: Monaco) => {
    if (completionRegisteredRef.current) return;

    const snippetKind = monaco.languages.CompletionItemKind.Snippet;
    const insertAsSnippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

    monaco.languages.registerCompletionItemProvider("python", {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: "for-range",
            kind: snippetKind,
            documentation: "for i in range(...)",
            insertText: "for ${1:i} in range(${2:n}):\n\t${0:pass}",
            insertTextRules: insertAsSnippet
          },
          {
            label: "if-main",
            kind: snippetKind,
            documentation: "__name__ == '__main__'",
            insertText: "if __name__ == '__main__':\n\t${0:pass}",
            insertTextRules: insertAsSnippet
          }
        ]
      })
    });

    monaco.languages.registerCompletionItemProvider("cpp", {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: "fast-io",
            kind: snippetKind,
            documentation: "빠른 입출력 설정",
            insertText: "ios::sync_with_stdio(false);\ncin.tie(nullptr);",
            insertTextRules: insertAsSnippet
          },
          {
            label: "for-loop",
            kind: snippetKind,
            documentation: "for 루프",
            insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t${0}\n}",
            insertTextRules: insertAsSnippet
          }
        ]
      })
    });

    monaco.languages.registerCompletionItemProvider("java", {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: "for-loop",
            kind: snippetKind,
            documentation: "for 루프",
            insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${0}\n}",
            insertTextRules: insertAsSnippet
          }
        ]
      })
    });

    monaco.languages.registerCompletionItemProvider("javascript", {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: "for-of",
            kind: snippetKind,
            documentation: "for...of 루프",
            insertText: "for (const ${1:item} of ${2:arr}) {\n\t${0}\n}",
            insertTextRules: insertAsSnippet
          }
        ]
      })
    });

    completionRegisteredRef.current = true;
  };

  return (
    <div className="flex flex-col gap-4">
      {problemDesc && (
        <section className="p-6 bg-neutral-900 rounded-lg border border-neutral-700 shadow-sm">
          <h3 className="font-bold text-lg mb-2 text-neutral-100">문제 설명</h3>
          <MarkdownMath className="prose prose-invert max-w-none text-neutral-100 text-sm leading-relaxed" content={problemDesc} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-bold text-sm mb-1 text-neutral-200">입력</h4>
              <MarkdownMath className="prose prose-invert max-w-none text-sm text-neutral-200 leading-relaxed" content={inputDesc} />
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1 text-neutral-200">출력</h4>
              <MarkdownMath className="prose prose-invert max-w-none text-sm text-neutral-200 leading-relaxed" content={outputDesc} />
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between bg-neutral-900 p-4 rounded-lg border border-neutral-700 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-neutral-300 mb-1">언어</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-sm font-medium text-neutral-100 focus:ring-2 focus:ring-blue-500"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_META[lang].label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-8 w-px bg-neutral-700 mx-2 hidden md:block" />

          <div className="flex flex-col justify-center">
            <span className="text-sm font-semibold text-neutral-100">
              {problemId ? `문제: ${problemTitle || problemId}` : "문제를 선택하세요"}
            </span>
            {saveHint ? <span className="text-xs text-emerald-400 mt-1">{saveHint}</span> : null}
          </div>

          <div className="h-8 w-px bg-neutral-700 mx-2 hidden md:block" />

          <div className="flex flex-col justify-center gap-1">
            <span className="text-xs font-semibold text-neutral-300">코드 공개 범위</span>
            <div className="flex items-center gap-3 text-xs text-neutral-200 flex-wrap">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="visibility" checked={visibility === "PRIVATE"} onChange={() => setVisibility("PRIVATE")} />
                비공개
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="visibility" checked={visibility === "PUBLIC"} onChange={() => setVisibility("PUBLIC")} />
                전체공개
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === "ACCEPTED_ONLY"}
                  onChange={() => setVisibility("ACCEPTED_ONLY")}
                />
                맞은 후만 공개
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all",
              "bg-neutral-700 text-white hover:bg-neutral-600 shadow-sm hover:shadow"
            )}
            onClick={() => saveDraft()}
          >
            임시저장
          </button>

          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all",
              "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow disabled:opacity-60"
            )}
            onClick={handleRun}
            disabled={running || !runEnabled}
            title={!runEnabled ? "프로덕션에서는 Run이 비활성화됩니다. Submit을 사용하세요." : undefined}
          >
            <Play className="w-4 h-4" />
            {!runEnabled ? "실행 비활성화" : running ? "실행 중..." : "실행"}
          </button>

          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all",
              "bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow"
            )}
            onClick={handleSubmit}
          >
            <Play className="w-4 h-4" />
            제출하기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 min-h-0">
        <div className="h-[62vh] rounded-lg border border-neutral-700 overflow-hidden shadow-sm bg-black">
          <Editor
            height="100%"
            language={LANGUAGE_META[language].monaco}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || "")}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'D2Coding', 'Fira Code', Consolas, monospace",
              lineHeight: 22,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              insertSpaces: true,
              detectIndentation: false,
              guides: {
                indentation: true,
                highlightActiveIndentation: true,
                bracketPairs: true,
                bracketPairsHorizontal: true
              },
              bracketPairColorization: {
                enabled: true,
                independentColorPoolPerBracketType: true
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true
              },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: "on",
              tabCompletion: "on",
              wordBasedSuggestions: "currentDocument",
              parameterHints: { enabled: true },
              inlineSuggest: { enabled: true },
              snippetSuggestions: "top"
            }}
          />
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-neutral-100">테스트 입력</h3>
              <span className="text-xs text-neutral-400">제출 전 로컬 실행</span>
            </div>
            <textarea
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder="여기에 테스트 입력을 넣고 실행하세요."
              className="w-full h-36 resize-y rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-neutral-100"
            />
          </section>

          <section className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-neutral-100">실행 결과</h3>
              <span className="text-xs text-neutral-300">
                상태: <span className="font-mono">{runStatus}</span>
                {typeof runTimeMs === "number" ? ` · ${runTimeMs}ms` : ""}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-neutral-400 mb-1">stdout</div>
                <pre className="rounded border border-neutral-700 bg-neutral-950 p-3 text-xs font-mono whitespace-pre-wrap break-words min-h-16">
                  {runStdout || "(empty)"}
                </pre>
              </div>

              <div>
                <div className="text-xs text-neutral-400 mb-1">stderr</div>
                <pre className="rounded border border-neutral-700 bg-neutral-950 p-3 text-xs font-mono whitespace-pre-wrap break-words min-h-16 text-red-300">
                  {runStderr || "(empty)"}
                </pre>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

