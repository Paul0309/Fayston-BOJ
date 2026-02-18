"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEYS, DIVISIONS } from "../../lib/contest";
import ThemeToggle from "../components/ThemeToggle";
import Icon from "../components/Icon";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const readStorage = (key, fb) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; }
};

const getInitials = (name) => (name ? name.slice(0, 2).toUpperCase() : "?");

const DIV_RANK = Object.fromEntries(DIVISIONS.map((d, i) => [d, i])); // Bronze=0 … Platinum=3

// Acceptance rate = problems accepted / (contests * 3)
function acceptanceRate(history, username) {
  const records = history.filter((r) => r.username === username);
  if (records.length === 0) return 0;
  const solved = records.reduce((s, r) => s + r.problems.filter((p) => p.score === 100).length, 0);
  return solved / (records.length * 3);
}

// ─── Ranking page ─────────────────────────────────────────────────────────────
export default function RankingPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [rows, setRows] = useState([]);  // computed ranking rows
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const users = readStorage(STORAGE_KEYS.users, []);
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
    const current = readStorage(STORAGE_KEYS.current, null);
    setCurrentUser(current);

    // Build one row per user
    const ranked = users
      .map((u) => {
        const rate = acceptanceRate(history, u.username);
        const contests = history.filter((r) => r.username === u.username).length;
        const solved = history
          .filter((r) => r.username === u.username)
          .reduce((s, r) => s + r.problems.filter((p) => p.score === 100).length, 0);
        return { username: u.username, division: u.division, platinumComplete: !!u.platinumComplete, rate, contests, solved };
      })
      // Sort: higher division first; ties broken by acceptance rate desc
      .sort((a, b) => {
        const divDiff = DIV_RANK[b.division] - DIV_RANK[a.division];
        if (divDiff !== 0) return divDiff;
        // platinum-complete users rank above others in the same division
        if (a.platinumComplete !== b.platinumComplete) return a.platinumComplete ? -1 : 1;
        return b.rate - a.rate;
      });

    setRows(ranked);
    setHydrated(true);
  }, []);

  const divStyle = { Bronze: "div-bronze", Silver: "div-silver", Gold: "div-gold", Platinum: "div-plat" };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo">&lt;/&gt; USACO School</Link>
          <div className="nav-links">
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/ranking" className="nav-link" style={{ color: "var(--blue)" }}><Icon name="trophy" className="icon" /> Ranking</Link>
            <Link href="/past-competitions" className="nav-link"><Icon name="archive" className="icon" /> Past Competitions</Link>
            {currentUser && <Link href="/profile" className="nav-link"><Icon name="user" className="icon" /> Profile</Link>}
          </div>
          <div className="nav-right">
            <ThemeToggle />
            <Link href="/" className="btn btn-outline" style={{ fontSize: "0.82rem", padding: "0.35rem 0.7rem" }}>
              <Icon name="back" className="icon" /> Back
            </Link>
          </div>
        </div>
      </nav>

      <div className="ranking-wrap">
        <div className="ranking-header">
          <h2><Icon name="trophy" className="icon" /> Global Ranking</h2>
          <p className="ranking-sub">Sorted by division, then acceptance rate.</p>
        </div>

        {!hydrated ? null : rows.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", color: "var(--muted)", padding: "3rem" }}>
            No users yet. <Link href="/auth" style={{ color: "var(--blue)" }}>Register <Icon name="forward" className="icon" /></Link>
          </div>
        ) : (
          <div className="ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th className="col-user">User</th>
                  <th className="col-div">Division</th>
                  <th className="col-rate">Acceptance</th>
                  <th className="col-solved">Solved</th>
                  <th className="col-contests">Contests</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isMe = currentUser?.username === row.username;
                  const rankBadge = i < 3 ? i + 1 : null;
                  return (
                    <tr key={row.username} className={isMe ? "ranking-row ranking-row-me" : "ranking-row"}>
                      <td className="col-rank">
                        {rankBadge
                          ? <span className="ranking-medal">{rankBadge}</span>
                          : <span className="ranking-num">{i + 1}</span>
                        }
                      </td>
                      <td className="col-user">
                        <div className="ranking-user">
                          <div className="ranking-avatar">{getInitials(row.username)}</div>
                          <span className="ranking-name">
                            <Link href={`/profile?user=${encodeURIComponent(row.username)}`} className="ranking-profile-link">
                              {row.username}
                            </Link>
                            {row.platinumComplete && (
                              <span className="ranking-champion-tag"><Icon name="trophy" className="icon" /> Champion</span>
                            )}
                          </span>
                          {isMe && <span className="ranking-you">You</span>}
                        </div>
                      </td>
                      <td className="col-div">
                        <span className={`div-badge ${divStyle[row.division]}`}>{row.division}</span>
                      </td>
                      <td className="col-rate">
                        <div className="ranking-bar-wrap">
                          <div
                            className="ranking-bar"
                            style={{ width: `${Math.round(row.rate * 100)}%` }}
                          />
                          <span className="ranking-bar-label">
                            {row.contests > 0 ? `${Math.round(row.rate * 100)}%` : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="col-solved">{row.solved}</td>
                      <td className="col-contests">{row.contests}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
