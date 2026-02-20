"use client";

import { useEffect, useMemo, useState } from "react";

type Division = "Bronze" | "Silver" | "Gold" | "Platinum";

type ContestSummary = {
  id: string;
  title: string;
  description: string | null;
  division: Division;
  startTime: string;
  endTime: string;
  isPublished: boolean;
  problems: Array<{ id: string; number: number; title: string; difficulty: string; tags: string }>;
  _count?: { participants: number };
};

type ProblemOption = {
  id: string;
  number: number;
  title: string;
  difficulty: string;
  tags: string;
};

type ParticipantItem = {
  userId: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string; division: string; createdAt: string };
};

const DIVISIONS: Division[] = ["Bronze", "Silver", "Gold", "Platinum"];

function toLocalInput(dateLike: string | Date) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function toIso(input: string) {
  return new Date(input).toISOString();
}

export default function AdminContestsPanel() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [contests, setContests] = useState<ContestSummary[]>([]);

  const [problemQuery, setProblemQuery] = useState("");
  const [problemLoading, setProblemLoading] = useState(false);
  const [problemOptions, setProblemOptions] = useState<ProblemOption[]>([]);
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);

  const [newProblems, setNewProblems] = useState<
    Array<{
      title: string;
      difficulty: string;
      tags: string;
      description: string;
      inputDesc: string;
      outputDesc: string;
      sampleInput: string;
      sampleOutput: string;
      hiddenInput: string;
      hiddenOutput: string;
      timeLimit: string;
      memoryLimit: string;
    }>
  >([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    division: "Bronze" as Division,
    startTime: "",
    endTime: "",
    isPublished: false
  });

  const [selectedContestId, setSelectedContestId] = useState("");
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [participantLoading, setParticipantLoading] = useState(false);
  const [participantEmails, setParticipantEmails] = useState("");

  const totalProblems = selectedProblemIds.length + newProblems.length;
  const selectedContest = useMemo(() => contests.find((c) => c.id === selectedContestId) || null, [contests, selectedContestId]);

  const loadContests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/contests", { cache: "no-store" });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setContests(Array.isArray(data.items) ? data.items : []);
      if (!selectedContestId && data.items?.[0]?.id) setSelectedContestId(data.items[0].id);
    } catch {
      setError("Failed to load contests");
    } finally {
      setLoading(false);
    }
  };

  const searchProblems = async (q: string) => {
    setProblemLoading(true);
    try {
      const res = await fetch(`/api/admin/problems?limit=100&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setProblemOptions(Array.isArray(data.items) ? data.items : []);
    } finally {
      setProblemLoading(false);
    }
  };

  const loadParticipants = async (contestId: string) => {
    if (!contestId) return;
    setParticipantLoading(true);
    try {
      const res = await fetch(`/api/admin/contests/${contestId}/participants`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setParticipants(Array.isArray(data.items) ? data.items : []);
    } finally {
      setParticipantLoading(false);
    }
  };

  useEffect(() => {
    void loadContests();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void searchProblems(problemQuery), 200);
    return () => clearTimeout(timer);
  }, [problemQuery]);

  useEffect(() => {
    if (selectedContestId) void loadParticipants(selectedContestId);
  }, [selectedContestId]);

  const createContest = async () => {
    setError("");
    setMessage("");
    if (totalProblems !== 3) {
      setError("문제는 기존+신규 합쳐서 정확히 3개여야 합니다.");
      return;
    }
    if (!form.title || !form.startTime || !form.endTime) {
      setError("대회명/시작/종료는 필수입니다.");
      return;
    }

    try {
      const res = await fetch("/api/admin/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          division: form.division,
          startTime: toIso(form.startTime),
          endTime: toIso(form.endTime),
          isPublished: form.isPublished,
          problemIds: selectedProblemIds,
          newProblems
        })
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setMessage("대회 생성 완료");
      setSelectedProblemIds([]);
      setNewProblems([]);
      setForm((prev) => ({ ...prev, title: "", description: "" }));
      await loadContests();
    } catch {
      setError("Failed to create contest");
    }
  };

  const togglePublish = async (contest: ContestSummary) => {
    const res = await fetch(`/api/admin/contests/${contest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !contest.isPublished })
    });
    if (res.ok) void loadContests();
  };

  const deleteContest = async (contestId: string) => {
    if (!confirm("이 대회를 삭제할까요? 연결된 문제는 대회 연결만 해제됩니다.")) return;
    const res = await fetch(`/api/admin/contests/${contestId}`, { method: "DELETE" });
    if (res.ok) {
      await loadContests();
      if (selectedContestId === contestId) setSelectedContestId("");
    }
  };

  const addParticipants = async () => {
    if (!selectedContestId) return;
    const emails = participantEmails
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    const res = await fetch(`/api/admin/contests/${selectedContestId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails })
    });
    if (res.ok) {
      setParticipantEmails("");
      await loadParticipants(selectedContestId);
      await loadContests();
    } else {
      setError(await res.text());
    }
  };

  const removeParticipant = async (userId: string) => {
    if (!selectedContestId) return;
    const res = await fetch(`/api/admin/contests/${selectedContestId}/participants`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] })
    });
    if (res.ok) {
      await loadParticipants(selectedContestId);
      await loadContests();
    }
  };

  return (
    <section id="contest-management" className="mb-8">
      <h2 className="text-lg font-bold text-neutral-100 mb-4">USACO Contest Management</h2>

      {error ? <div className="mb-3 rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="mb-3 rounded border border-emerald-500/40 bg-emerald-950/30 p-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4 space-y-3">
          <h3 className="font-semibold text-neutral-100">Create Contest</h3>
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            placeholder="Contest name (e.g. 2026 Feb second contest)"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <textarea
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 min-h-20"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              value={form.division}
              onChange={(e) => setForm((prev) => ({ ...prev, division: e.target.value as Division }))}
            >
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              value={form.startTime}
              onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
            />
            <input
              type="datetime-local"
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              value={form.endTime}
              onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-neutral-200">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((prev) => ({ ...prev, isPublished: e.target.checked }))} />
            Publish immediately
          </label>

          <div className="rounded border border-neutral-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-neutral-100">Problems ({totalProblems}/3)</h4>
              <input
                className="w-52 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                placeholder="Search existing problems"
                value={problemQuery}
                onChange={(e) => setProblemQuery(e.target.value)}
              />
            </div>
            <div className="max-h-44 overflow-auto rounded border border-neutral-800">
              {problemLoading ? (
                <div className="p-2 text-xs text-neutral-400">Loading...</div>
              ) : (
                problemOptions.map((p) => {
                  const checked = selectedProblemIds.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1 text-xs border-b border-neutral-800 last:border-b-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedProblemIds((prev) =>
                            e.target.checked ? [...prev, p.id].slice(0, 3) : prev.filter((v) => v !== p.id)
                          );
                        }}
                      />
                      <span className="text-neutral-100">
                        #{p.number} {p.title}
                      </span>
                      <span className="text-neutral-500">{p.difficulty}</span>
                    </label>
                  );
                })
              )}
            </div>
            <button
              type="button"
              className="rounded border border-blue-600 px-2 py-1 text-xs text-blue-300"
              onClick={() =>
                setNewProblems((prev) => [
                  ...prev,
                  {
                    title: "",
                    difficulty: "BRONZE_3",
                    tags: "",
                    description: "",
                    inputDesc: "",
                    outputDesc: "",
                    sampleInput: "",
                    sampleOutput: "",
                    hiddenInput: "",
                    hiddenOutput: "",
                    timeLimit: "2000",
                    memoryLimit: "256"
                  }
                ])
              }
            >
              Add New Problem Slot
            </button>
            {newProblems.map((np, idx) => (
              <div key={idx} className="rounded border border-neutral-700 p-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-200">
                  <span>New Problem #{idx + 1}</span>
                  <button
                    type="button"
                    className="text-red-300"
                    onClick={() => setNewProblems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
                <input
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                  placeholder="Title"
                  value={np.title}
                  onChange={(e) =>
                    setNewProblems((prev) => prev.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item)))
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                    placeholder="Difficulty"
                    value={np.difficulty}
                    onChange={(e) =>
                      setNewProblems((prev) => prev.map((item, i) => (i === idx ? { ...item, difficulty: e.target.value } : item)))
                    }
                  />
                  <input
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                    placeholder="Tags"
                    value={np.tags}
                    onChange={(e) =>
                      setNewProblems((prev) => prev.map((item, i) => (i === idx ? { ...item, tags: e.target.value } : item)))
                    }
                  />
                </div>
                <textarea
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 min-h-16"
                  placeholder="Description"
                  value={np.description}
                  onChange={(e) =>
                    setNewProblems((prev) => prev.map((item, i) => (i === idx ? { ...item, description: e.target.value } : item)))
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <textarea
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 min-h-14"
                    placeholder="Sample input"
                    value={np.sampleInput}
                    onChange={(e) =>
                      setNewProblems((prev) => prev.map((item, i) => (i === idx ? { ...item, sampleInput: e.target.value } : item)))
                    }
                  />
                  <textarea
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 min-h-14"
                    placeholder="Sample output"
                    value={np.sampleOutput}
                    onChange={(e) =>
                      setNewProblems((prev) => prev.map((item, i) => (i === idx ? { ...item, sampleOutput: e.target.value } : item)))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={createContest}
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            Create Contest
          </button>
        </div>

        <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-100">Contest Operations</h3>
            <button type="button" className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-200" onClick={() => void loadContests()}>
              Refresh
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-auto">
            {contests.map((contest) => (
              <div key={contest.id} className="rounded border border-neutral-800 p-3 bg-neutral-900">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-neutral-100 hover:text-blue-300"
                    onClick={() => setSelectedContestId(contest.id)}
                  >
                    {contest.title}
                  </button>
                  <span className={`text-xs ${contest.isPublished ? "text-emerald-300" : "text-amber-300"}`}>
                    {contest.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-400">
                  {contest.division} | {new Date(contest.startTime).toLocaleString()} ~ {new Date(contest.endTime).toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-neutral-400">Problems: {contest.problems.map((p) => `#${p.number}`).join(", ") || "-"}</div>
                <div className="mt-1 text-xs text-neutral-400">Participants: {contest._count?.participants ?? 0}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-300"
                    onClick={() => void togglePublish(contest)}
                  >
                    {contest.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-200"
                    onClick={async () => {
                      await fetch(`/api/admin/contests/${contest.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ startTime: new Date().toISOString() })
                      });
                      void loadContests();
                    }}
                  >
                    Start now
                  </button>
                  <button
                    type="button"
                    className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-200"
                    onClick={async () => {
                      await fetch(`/api/admin/contests/${contest.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ endTime: new Date(Date.now() + 60_000).toISOString() })
                      });
                      void loadContests();
                    }}
                  >
                    End in 1m
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-700 px-2 py-1 text-xs text-red-300"
                    onClick={() => void deleteContest(contest.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded border border-neutral-800 p-3 bg-neutral-900">
            <h4 className="font-medium text-sm text-neutral-100 mb-2">Participant Management</h4>
            {selectedContest ? (
              <div className="text-xs text-neutral-300 mb-2">
                Selected: <span className="text-neutral-100">{selectedContest.title}</span>
              </div>
            ) : (
              <div className="text-xs text-neutral-500 mb-2">Select a contest above</div>
            )}
            <textarea
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 min-h-16"
              placeholder="학생 이메일(콤마/줄바꿈 구분) 입력 후 추가"
              value={participantEmails}
              onChange={(e) => setParticipantEmails(e.target.value)}
              disabled={!selectedContestId}
            />
            <button
              type="button"
              className="mt-2 rounded border border-blue-700 px-2 py-1 text-xs text-blue-300 disabled:opacity-50"
              disabled={!selectedContestId}
              onClick={() => void addParticipants()}
            >
              Add Participants
            </button>

            <div className="mt-3 space-y-1 max-h-48 overflow-auto">
              {participantLoading ? <div className="text-xs text-neutral-400">Loading participants...</div> : null}
              {!participantLoading &&
                participants.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between rounded border border-neutral-800 px-2 py-1 text-xs">
                    <div className="text-neutral-200">
                      {p.user.name || "(No name)"} - {p.user.email}
                    </div>
                    <button
                      type="button"
                      className="text-red-300"
                      onClick={() => void removeParticipant(p.userId)}
                      disabled={!selectedContestId}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {selectedContest ? (
        <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-950 p-4">
          <h3 className="font-semibold text-neutral-100 mb-2">Selected Contest Quick Edit</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              defaultValue={toLocalInput(selectedContest.startTime)}
              onBlur={async (e) => {
                await fetch(`/api/admin/contests/${selectedContest.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ startTime: toIso(e.target.value) })
                });
                void loadContests();
              }}
              type="datetime-local"
            />
            <input
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              defaultValue={toLocalInput(selectedContest.endTime)}
              onBlur={async (e) => {
                await fetch(`/api/admin/contests/${selectedContest.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ endTime: toIso(e.target.value) })
                });
                void loadContests();
              }}
              type="datetime-local"
            />
            <input
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              defaultValue={selectedContest.title}
              onBlur={async (e) => {
                await fetch(`/api/admin/contests/${selectedContest.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: e.target.value })
                });
                void loadContests();
              }}
              placeholder="Title"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

