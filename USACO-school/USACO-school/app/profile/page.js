"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEYS, LANG_LABELS } from "../../lib/contest";
import ThemeToggle from "../components/ThemeToggle";
import Icon from "../components/Icon";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const readStorage = (key, fb) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; }
};

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const fmtDate = (ts) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const getInitials = (name) => (name ? name.slice(0, 2).toUpperCase() : "?");

// ─── Profile page ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [requestedUser, setRequestedUser] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // "recordIdx-probId" of the currently expanded problem detail, or null
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedUser((params.get("user") || "").trim());
    setCurrentUser(readStorage(STORAGE_KEYS.current, null));
    setUsers(readStorage(STORAGE_KEYS.users, []));
    setHistory(JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]"));
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const viewedUsername = requestedUser || currentUser?.username || "";
  const viewedUser = users.find((u) => u.username === viewedUsername) || null;

  // Most-recent-first, filtered to the selected user
  const myHistory = history
    .filter((r) => r.username === viewedUsername)
    .slice()
    .reverse();

  const totalContests = myHistory.length;
  const totalPromoted = myHistory.filter((r) => r.promoted).length;
  const totalSolved = myHistory.reduce((s, r) => s + r.problems.filter((p) => p.score === 100).length, 0);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo">&lt;/&gt; USACO School</Link>
          <div className="nav-links">
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/ranking" className="nav-link"><Icon name="trophy" className="icon" /> Ranking</Link>
            <Link href="/past-competitions" className="nav-link"><Icon name="archive" className="icon" /> Past Competitions</Link>
          </div>
          <div className="nav-right">
            <ThemeToggle />
            <Link href="/" className="btn btn-outline" style={{ fontSize: "0.82rem", padding: "0.35rem 0.7rem" }}>
              <Icon name="back" className="icon" /> Back
            </Link>
          </div>
        </div>
      </nav>

      <div className="profile-wrap">
        {!viewedUsername ? (
          <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--ink2)" }}>No profile selected.</p>
            <Link href="/auth" className="btn btn-primary">Login</Link>
          </div>
        ) : !viewedUser && myHistory.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--ink2)" }}>User not found.</p>
            <Link href="/ranking" className="btn btn-primary">Back to Ranking</Link>
          </div>
        ) : (
          <>
            {/* ── User header ── */}
            <div className="profile-header">
              <div className="profile-avatar-lg">{getInitials(viewedUsername)}</div>
              <div className="profile-info">
                <h2>{viewedUsername}</h2>
                <p>
                  Division:{" "}
                  <strong style={{ color: "var(--blue)" }}>{viewedUser?.division || "Unknown"}</strong>
                </p>
              </div>
            </div>

            {/* ── Summary stats ── */}
            <div className="profile-stats">
              <div className="stat-card">
                <p className="stat-val">{totalContests}</p>
                <p className="stat-label">Contests Attempted</p>
              </div>
              <div className="stat-card">
                <p className="stat-val green">{totalPromoted}</p>
                <p className="stat-label">Promotions</p>
              </div>
              <div className="stat-card">
                <p className="stat-val">{totalSolved}</p>
                <p className="stat-label">Problems Accepted</p>
              </div>
              <div className="stat-card">
                <p className="stat-val">
                  {totalContests > 0 ? Math.round((totalSolved / (totalContests * 3)) * 100) : 0}%
                </p>
                <p className="stat-label">Acceptance Rate</p>
              </div>
            </div>

            {/* ── Contest history ── */}
            <div className="history-section">
              <h3>Contest History</h3>

              {myHistory.length === 0 ? (
                <div className="panel" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  No contests completed yet.{" "}
                  <Link href="/" style={{ color: "var(--blue)" }}>Start one <Icon name="forward" className="icon" /></Link>
                </div>
              ) : (
                myHistory.map((record, idx) => (
                  <div key={idx} className="history-card">

                    {/* Card header: division badge + result + duration + date */}
                    <div className="history-card-top">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span className="history-div">{record.division}</span>
                        <span className={record.promoted ? "history-badge-promoted" : "history-badge-expired"}>
                          {record.promoted ? "Promoted ↑" : "Time expired"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <span className="history-date" style={{ color: "var(--muted)" }}>
                          <Icon name="clock" className="icon" /> {fmt(record.duration)}
                        </span>
                        <span className="history-date">{fmtDate(record.date)}</span>
                      </div>
                    </div>

                    {/* Problem chips — click any chip to expand its submission detail */}
                    <div className="history-problems">
                      {record.problems.map((p) => {
                        const key = `${idx}-${p.id}`;
                        const isExpanded = expandedKey === key;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="prob-chip"
                            onClick={() => setExpandedKey(isExpanded ? null : key)}
                          >
                            {p.title}
                            <span className={`prob-chip-score${p.score === 100 ? " perfect" : p.score > 0 ? " partial" : " zero"}`}>
                              {p.score}/100
                            </span>
                            {p.attempts > 0 && (
                              <span style={{ color: "var(--muted)", fontSize: "0.73rem" }}>×{p.attempts}</span>
                            )}
                            <span className="prob-chip-expand">{isExpanded ? "▲" : "▼"}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Expandable detail panels (only the currently selected one renders) */}
                    {record.problems.map((p) => {
                      const key = `${idx}-${p.id}`;
                      if (expandedKey !== key) return null;
                      return (
                        <div key={`detail-${p.id}`} className="prob-detail">

                          {/* Language used */}
                          <div className="prob-detail-meta">
                            Language:{" "}
                            <strong>{LANG_LABELS[p.language] || p.language || "Unknown"}</strong>
                          </div>

                          {/* Submission log */}
                          {(p.submissionLogs || []).length > 0 && (
                            <div className="prob-detail-logs">
                              <div className="prob-detail-section-label">Submission log</div>
                              {p.submissionLogs.map((log, i) => (
                                <div
                                  key={i}
                                  className={`sub-log-entry${log.startsWith("✓") ? " pass" : " fail"}`}
                                >
                                  {i + 1}. {log}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Final code */}
                          {p.code ? (
                            <div className="prob-detail-code-wrap">
                              <div className="prob-detail-section-label">
                                Final code ({LANG_LABELS[p.language] || p.language})
                              </div>
                              <pre className="prob-detail-code">{p.code}</pre>
                            </div>
                          ) : (
                            <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
                              No code saved (older contest record).
                            </p>
                          )}

                        </div>
                      );
                    })}

                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
