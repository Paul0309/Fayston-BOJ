"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_META, type SupportedLanguage } from "@/lib/languages";
import MarkdownMath from "@/components/MarkdownMath";

const DIFFICULTIES = [
    "BRONZE_5", "BRONZE_4", "BRONZE_3", "BRONZE_2", "BRONZE_1",
    "SILVER_5", "SILVER_4", "SILVER_3", "SILVER_2", "SILVER_1",
    "GOLD_5", "GOLD_4", "GOLD_3", "GOLD_2", "GOLD_1"
];

interface AdminProblemFormProps {
    initialAllowedLanguages: SupportedLanguage[];
}

type CaseValidationResult = {
    errors: string[];
    warnings: string[];
    checkedAt: string;
};

type SimilarProblemItem = {
    id: string;
    number: number;
    title: string;
    difficulty: string;
    tags: string;
    score: number;
};

function validateExamples(examples: Array<{ input: string; output: string; score: string; isHidden: boolean }>): CaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (examples.length === 0) {
        errors.push("테스트케이스가 없습니다.");
    }

    const visibleCount = examples.filter((e) => !e.isHidden).length;
    const hiddenCount = examples.filter((e) => e.isHidden).length;
    const totalScore = examples.reduce((acc, e) => acc + (Number(e.score) || 0), 0);
    const duplicateMap = new Map<string, number[]>();

    examples.forEach((e, idx) => {
        if (!e.input.trim() && !e.output.trim()) {
            warnings.push(`케이스 ${idx + 1}: 입력/출력이 모두 비어 있습니다.`);
        } else {
            if (!e.input.trim()) warnings.push(`케이스 ${idx + 1}: 입력이 비어 있습니다.`);
            if (!e.output.trim()) warnings.push(`케이스 ${idx + 1}: 출력이 비어 있습니다.`);
        }
        if ((Number(e.score) || 0) <= 0) {
            errors.push(`케이스 ${idx + 1}: 점수는 1 이상이어야 합니다.`);
        }

        const key = `${e.input.trim()}\n---\n${e.output.trim()}`;
        const arr = duplicateMap.get(key) || [];
        arr.push(idx + 1);
        duplicateMap.set(key, arr);
    });

    if (visibleCount === 0) {
        errors.push("공개(예제) 케이스가 없습니다.");
    }
    if (hiddenCount === 0) {
        warnings.push("숨김 케이스가 없습니다. 하드코딩 방지를 위해 숨김 케이스 추가를 권장합니다.");
    }
    if (totalScore !== 100) {
        warnings.push(`점수 합계가 100점이 아닙니다. (현재 ${totalScore}점)`);
    }

    for (const indices of duplicateMap.values()) {
        if (indices.length > 1) {
            warnings.push(`중복 케이스가 있습니다: ${indices.join(", ")}번`);
        }
    }

    return {
        errors,
        warnings,
        checkedAt: new Date().toLocaleTimeString("ko-KR")
    };
}

export default function AdminProblemForm({ initialAllowedLanguages }: AdminProblemFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [autoLoading, setAutoLoading] = useState(false);
    const [languageLoading, setLanguageLoading] = useState(false);
    const [error, setError] = useState("");
    const [autoMessage, setAutoMessage] = useState("");
    const [languageMessage, setLanguageMessage] = useState("");
    const [autoMode, setAutoMode] = useState(false);
    const [intervalMinutes, setIntervalMinutes] = useState("5");
    const [allowedLanguages, setAllowedLanguages] = useState<SupportedLanguage[]>(initialAllowedLanguages);
    const [examples, setExamples] = useState([{ input: "", output: "", score: "100", isHidden: false, groupName: "default" }]);
    const [autoConfig, setAutoConfig] = useState({ count: "5", topic: "mixed", difficulty: "BRONZE_3" });
    const [caseValidation, setCaseValidation] = useState<CaseValidationResult | null>(null);
    const [similarityLoading, setSimilarityLoading] = useState(false);
    const [similarityItems, setSimilarityItems] = useState<SimilarProblemItem[]>([]);
    const [form, setForm] = useState({
        number: "",
        title: "",
        difficulty: "BRONZE_5",
        tags: "",
        description: "",
        inputDesc: "",
        outputDesc: "",
        timeLimit: "1000",
        memoryLimit: "128"
    });

    const languageList = useMemo(() => Object.keys(LANGUAGE_META) as SupportedLanguage[], []);

    const updateExample = (index: number, key: "input" | "output" | "score" | "groupName" | "isHidden", value: string | boolean) => {
        setExamples((prev) => prev.map((e, i) => (i === index ? { ...e, [key]: value } : e)));
    };

    const toggleLanguage = (lang: SupportedLanguage) => {
        setAllowedLanguages((prev) => {
            if (prev.includes(lang)) {
                if (prev.length === 1) return prev;
                return prev.filter((value) => value !== lang);
            }
            return [...prev, lang];
        });
    };

    const saveLanguageSettings = async () => {
        setLanguageLoading(true);
        setError("");
        setLanguageMessage("");

        try {
            const res = await fetch("/api/admin/settings/languages", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ languages: allowedLanguages })
            });

            if (!res.ok) {
                setError(await res.text());
                return;
            }

            const data = await res.json();
            setAllowedLanguages(data.allowedLanguages);
            setLanguageMessage("제출 언어 설정을 저장했습니다.");
            router.refresh();
        } catch (err) {
            console.error(err);
            setError("언어 설정 저장 중 오류가 발생했습니다.");
        } finally {
            setLanguageLoading(false);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/problems", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, examples })
            });

            if (!res.ok) {
                setError(await res.text());
                return;
            }

            const data = await res.json();
            router.push(`/problem/${data.id}`);
            router.refresh();
        } catch (err) {
            console.error(err);
            setError("문제 생성 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleAutoGenerate = useCallback(async () => {
        setAutoLoading(true);
        setError("");
        setAutoMessage("");
        try {
            const res = await fetch("/api/admin/problems/autogen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ count: Number(autoConfig.count), topic: autoConfig.topic, difficulty: autoConfig.difficulty })
            });
            if (!res.ok) {
                setError(await res.text());
                return;
            }
            const data = await res.json();
            const report = data.report || {};
            setAutoMessage(
                `${data.createdCount}개 생성 (중복 거절 ${report.duplicateRejected ?? 0}, 유사도 거절 ${report.similarityRejected ?? 0}, 사전검증 거절 ${report.prevalidationRejected ?? 0})`
            );
            router.refresh();
        } catch (err) {
            console.error(err);
            setError("자동 생성 중 오류가 발생했습니다.");
        } finally {
            setAutoLoading(false);
        }
    }, [autoConfig, router]);

    const checkSimilarity = async () => {
        const title = form.title.trim();
        const description = form.description.trim();
        if (!title && !description) {
            setError("유사도 점검을 위해 제목 또는 설명을 입력하세요.");
            return;
        }
        setSimilarityLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/problems/similarity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description, limit: 8 })
            });
            if (!res.ok) {
                setError(await res.text());
                return;
            }
            const data = await res.json();
            setSimilarityItems(Array.isArray(data.items) ? data.items : []);
        } catch (err) {
            console.error(err);
            setError("유사 문제 점검 중 오류가 발생했습니다.");
        } finally {
            setSimilarityLoading(false);
        }
    };

    const intervalMs = useMemo(() => {
        const minutes = Number(intervalMinutes);
        if (!Number.isFinite(minutes) || minutes <= 0) return 5 * 60 * 1000;
        return Math.max(minutes, 1) * 60 * 1000;
    }, [intervalMinutes]);

    useEffect(() => {
        if (!autoMode) return;
        const timer = setInterval(() => {
            void handleAutoGenerate();
        }, intervalMs);
        return () => clearInterval(timer);
    }, [autoMode, intervalMs, handleAutoGenerate]);

    return (
        <form onSubmit={submit} className="space-y-4 text-neutral-100">
            {error && <div className="rounded border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>}
            {autoMessage && <div className="rounded border border-emerald-400/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">{autoMessage}</div>}
            {languageMessage && <div className="rounded border border-blue-400/40 bg-blue-950/40 px-3 py-2 text-sm text-blue-200">{languageMessage}</div>}

            <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-neutral-950 via-slate-950 to-blue-950/60 p-4 space-y-3 shadow-lg">
                <div className="font-semibold text-blue-200">제출 언어 관리</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {languageList.map((lang) => (
                        <label key={lang} className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 cursor-pointer">
                            <input type="checkbox" checked={allowedLanguages.includes(lang)} onChange={() => toggleLanguage(lang)} />
                            {LANGUAGE_META[lang].label}
                        </label>
                    ))}
                </div>
                <p className="text-xs text-blue-200/80">최소 1개 언어는 켜져 있어야 합니다. 비활성화된 언어는 제출 페이지에서 숨겨지고 서버에서 차단됩니다.</p>
                <button type="button" onClick={saveLanguageSettings} disabled={languageLoading} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                    {languageLoading ? "저장 중..." : "언어 설정 저장"}
                </button>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-neutral-950 via-slate-950 to-cyan-950/60 p-4 space-y-3 shadow-lg">
                <div className="font-semibold text-cyan-200">AI 자동 문제 생성</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-500" placeholder="개수 (1~20)" value={autoConfig.count} onChange={(e) => setAutoConfig({ ...autoConfig, count: e.target.value })} />
                    <select className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100" value={autoConfig.topic} onChange={(e) => setAutoConfig({ ...autoConfig, topic: e.target.value })}>
                        <option value="mixed">혼합</option><option value="math">수학</option><option value="string">문자열</option>
                    </select>
                    <select className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100" value={autoConfig.difficulty} onChange={(e) => setAutoConfig({ ...autoConfig, difficulty: e.target.value })}>
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <button type="button" onClick={handleAutoGenerate} disabled={autoLoading} className="rounded bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500 disabled:opacity-50">
                    {autoLoading ? "자동 생성 중..." : "자동 생성 실행"}
                </button>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-neutral-200">
                        <input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} />주기적 자동 생성
                    </label>
                    <input className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm w-24 text-neutral-100" value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} placeholder="분" />
                    <span className="text-xs text-cyan-200/80">탭이 열려있는 동안 N분마다 생성</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="문제 번호" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
                <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => void checkSimilarity()}
                    disabled={similarityLoading}
                    className="rounded bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
                >
                    {similarityLoading ? "점검 중..." : "유사 문제 점검"}
                </button>
                <span className="text-xs text-neutral-400">제목/설명 기준으로 기존 문제와 유사도를 비교합니다.</span>
            </div>
            {similarityItems.length > 0 && (
                <div className="rounded border border-fuchsia-500/40 bg-fuchsia-950/20 p-3">
                    <div className="mb-2 text-sm font-semibold text-fuchsia-200">유사 문제 후보</div>
                    <div className="space-y-1 text-xs text-fuchsia-100">
                        {similarityItems.map((item) => (
                            <div key={item.id}>
                                #{item.number} {item.title} · score {(item.score * 100).toFixed(1)}% · {item.difficulty}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="태그 (쉼표 구분)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>

            <textarea className="w-full min-h-36 rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="문제 설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <textarea className="w-full min-h-20 rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="입력 설명" value={form.inputDesc} onChange={(e) => setForm({ ...form, inputDesc: e.target.value })} />
            <textarea className="w-full min-h-20 rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="출력 설명" value={form.outputDesc} onChange={(e) => setForm({ ...form, outputDesc: e.target.value })} />
            <p className="text-xs text-neutral-400">수식 표기: 인라인은 <code>$...$</code>, 블록 수식은 <code>$$...$$</code>를 사용할 수 있습니다.</p>
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-neutral-950 via-slate-950 to-emerald-950/40 p-4 space-y-3">
                <div className="font-semibold text-emerald-200">문제 미리보기</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <div className="mb-2 text-xs font-semibold text-emerald-100/80">문제</div>
                        <div className="max-h-72 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-3">
                            <MarkdownMath className="prose prose-invert max-w-none text-sm" statementMode content={form.description || "문제 설명 미리보기"} />
                        </div>
                    </div>
                    <div>
                        <div className="mb-2 text-xs font-semibold text-emerald-100/80">입력</div>
                        <div className="max-h-72 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-3">
                            <MarkdownMath className="prose prose-invert max-w-none text-sm" statementMode content={form.inputDesc || "입력 설명 미리보기"} />
                        </div>
                    </div>
                    <div>
                        <div className="mb-2 text-xs font-semibold text-emerald-100/80">출력</div>
                        <div className="max-h-72 overflow-auto rounded border border-neutral-700 bg-neutral-950 p-3">
                            <MarkdownMath className="prose prose-invert max-w-none text-sm" statementMode content={form.outputDesc || "출력 설명 미리보기"} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="시간 제한(ms)" value={form.timeLimit} onChange={(e) => setForm({ ...form, timeLimit: e.target.value })} />
                <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="메모리 제한(MB)" value={form.memoryLimit} onChange={(e) => setForm({ ...form, memoryLimit: e.target.value })} />
            </div>

            <div className="space-y-2">
                <div className="font-semibold">예제</div>
                {examples.map((ex, i) => (
                    <div key={i} className="space-y-2 rounded border border-neutral-700 p-3 bg-neutral-900">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="그룹명|조건 (예: subtask1|N <= 20)" value={ex.groupName} onChange={(e) => updateExample(i, "groupName", e.target.value)} />
                            <div className="grid grid-cols-2 gap-2">
                                <input className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2" placeholder="점수" value={ex.score} onChange={(e) => updateExample(i, "score", e.target.value)} />
                                <label className="flex items-center gap-2 rounded border border-neutral-700 px-3 py-2 text-sm">
                                    <input type="checkbox" checked={ex.isHidden} onChange={(e) => updateExample(i, "isHidden", e.target.checked)} />숨김 케이스
                                </label>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <textarea className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 min-h-20" placeholder={`예제 입력 ${i + 1}`} value={ex.input} onChange={(e) => updateExample(i, "input", e.target.value)} />
                            <textarea className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 min-h-20" placeholder={`예제 출력 ${i + 1}`} value={ex.output} onChange={(e) => updateExample(i, "output", e.target.value)} />
                        </div>
                    </div>
                ))}
                <p className="text-xs text-neutral-400">
                    채점 기준 표시 팁: 그룹명을 <code>label|constraint</code> 형식으로 입력하면 문제 페이지에서
                    <code>Inputs 3-4: constraint</code> 형태로 자동 표시됩니다.
                </p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                        onClick={() => setCaseValidation(validateExamples(examples))}
                    >
                        테스트케이스 점검
                    </button>
                    {caseValidation && (
                        <span className="text-xs text-neutral-400">마지막 점검: {caseValidation.checkedAt}</span>
                    )}
                </div>
                {caseValidation && (
                    <div className="space-y-2 rounded border border-neutral-700 bg-neutral-950 p-3 text-sm">
                        {caseValidation.errors.length === 0 && caseValidation.warnings.length === 0 ? (
                            <div className="text-emerald-300">문제 없음: 기본 검증을 통과했습니다.</div>
                        ) : (
                            <>
                                {caseValidation.errors.length > 0 && (
                                    <div>
                                        <div className="mb-1 font-semibold text-red-300">오류</div>
                                        <ul className="list-disc space-y-1 pl-5 text-red-200">
                                            {caseValidation.errors.map((msg, idx) => (
                                                <li key={`err-${idx}`}>{msg}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {caseValidation.warnings.length > 0 && (
                                    <div>
                                        <div className="mb-1 font-semibold text-amber-300">경고</div>
                                        <ul className="list-disc space-y-1 pl-5 text-amber-200">
                                            {caseValidation.warnings.map((msg, idx) => (
                                                <li key={`warn-${idx}`}>{msg}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
                <button type="button" className="text-sm text-blue-400 hover:underline" onClick={() => setExamples((prev) => [...prev, { input: "", output: "", score: "100", isHidden: false, groupName: "default" }])}>예제 추가</button>
            </div>

            <button disabled={loading} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {loading ? "생성 중..." : "문제 생성"}
            </button>
        </form>
    );
}
