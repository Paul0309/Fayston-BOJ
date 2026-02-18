"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CONTEST_WEEKDAY, STORAGE_KEYS, makeContest, normalizeContest } from "../lib/contest";
import ThemeToggle from "./components/ThemeToggle";
import Icon from "./components/Icon";

const readStorage = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const writeStorage = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const getInitials = (n) => n ? n.slice(0, 2).toUpperCase() : "?";

function getNextFriday() {
  const d = new Date();
  const daysUntil = (CONTEST_WEEKDAY - d.getDay() + 7) % 7 || 7; // if today is Friday this returns 7 (next Friday)
  d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [contest, setContest] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCurrentUser(readStorage(STORAGE_KEYS.current, null));
    setContest(normalizeContest(readStorage(STORAGE_KEYS.contest, null)));
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) currentUser ? writeStorage(STORAGE_KEYS.current, currentUser) : localStorage.removeItem(STORAGE_KEYS.current); }, [currentUser, hydrated]);
  useEffect(() => { if (hydrated) contest ? writeStorage(STORAGE_KEYS.contest, contest) : localStorage.removeItem(STORAGE_KEYS.contest); }, [contest, hydrated]);
  useEffect(() => { if (currentUser && contest && contest.username !== currentUser.username) setContest(null); }, [currentUser, contest]);

  const hasContest = Boolean(currentUser && contest && contest.username === currentUser.username);
  const isContestDay = new Date().getDay() === CONTEST_WEEKDAY;
  const isPlatinumComplete = Boolean(currentUser?.platinumComplete);
  const nextFriday = getNextFriday();

  function startContest() {
    if (!hydrated) return;
    if (isPlatinumComplete) return;
    if (!currentUser) { router.push("/auth"); return; }
    if (!isContestDay && !hasContest) return; // can't start new contest on non-Friday; resuming is fine
    if (hasContest) { router.push("/contest"); return; }
    const c = makeContest(currentUser.division, currentUser.username);
    setContest(c);
    writeStorage(STORAGE_KEYS.contest, c);
    router.push("/contest");
  }

  function logout() {
    setCurrentUser(null);
    setContest(null);
    localStorage.removeItem(STORAGE_KEYS.current);
    localStorage.removeItem(STORAGE_KEYS.contest);
  }

  // Whether the contest nav/hero button should be available
  const canStartOrResume = !isPlatinumComplete && (isContestDay || hasContest);

  return (
    <>
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo">&lt;/&gt; USACO School</Link>

          <div className="nav-links">
            <button
              type="button"
              className="nav-link"
              onClick={startContest}
              disabled={!hydrated || !canStartOrResume}
              title={!canStartOrResume ? (isPlatinumComplete ? "All divisions complete!" : `Contests open on Fridays — next: ${nextFriday}`) : undefined}
            >
              <Icon name="contest" className="icon" /> Contest
            </button>
            <Link href="/ranking" className="nav-link"><Icon name="trophy" className="icon" /> Ranking</Link>
            <Link href="/past-competitions" className="nav-link"><Icon name="archive" className="icon" /> Past Competitions</Link>
            {currentUser && (
              <Link href="/profile" className="nav-link"><Icon name="user" className="icon" /> Profile</Link>
            )}
          </div>

          <div className="nav-right">
            <ThemeToggle />
            {hydrated && currentUser ? (
              <>
                <div className="nav-user">
                  <div className="nav-avatar">{getInitials(currentUser.username)}</div>
                  <span style={{ fontSize: "0.85rem" }}>{currentUser.username}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>· {currentUser.division}</span>
                </div>
                <button type="button" className="btn btn-outline" style={{ fontSize: "0.8rem", padding: "0.32rem 0.65rem" }} onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <Link href="/auth" className="btn btn-primary" style={{ fontSize: "0.87rem" }}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        {/* Left: copy */}
        <div className="hero-left">
          <p className="hero-badge">Competitive Programming</p>
          <h1 className="hero-h1">
            The judge<br />
            <em>never lies.</em>
          </h1>
          <p className="hero-p">
            One 30-minute contest. Three problems. Score is based on test cases
            passed — but you need <strong>100/100</strong> on every problem to earn a promotion.
          </p>

          {/* ── CTA area — three possible states ── */}
          {hydrated && isPlatinumComplete ? (
            /* State 1: user has beaten Platinum — show congratulations, no start button */
            <div className="champion-banner">
              <Icon name="trophy" className="champion-trophy" />
              <div>
                <div className="champion-title">USACO School Champion</div>
                <div className="champion-sub">
                  You&apos;ve conquered all four divisions. There&apos;s nothing left to prove.
                </div>
              </div>
            </div>
          ) : hydrated && !isContestDay && !hasContest ? (
            /* State 2: not Friday and no in-progress contest — locked */
            <div className="hero-btns">
              <div className="contest-locked">
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "0.97rem", padding: "0.72rem 1.6rem", opacity: 0.45, cursor: "not-allowed" }}
                  disabled
                >
                  <Icon name="lock" className="icon" /> Contest opens Fridays
                </button>
                <span className="contest-locked-sub">Next contest: <strong>{nextFriday}</strong></span>
              </div>
              {!currentUser && (
                <Link href="/auth" className="btn btn-outline" style={{ fontSize: "0.97rem", padding: "0.72rem 1.4rem" }}>
                  Register free
                </Link>
              )}
            </div>
          ) : (
            /* State 3: Friday (or resuming an existing contest) — normal CTA */
            <div className="hero-btns">
              <button
                className="btn btn-primary"
                style={{ fontSize: "0.97rem", padding: "0.72rem 1.6rem" }}
                onClick={startContest}
                disabled={!hydrated}
              >
                {hasContest ? "Resume Contest" : "Start Contest"} <Icon name="forward" className="icon" />
              </button>
              {!currentUser && (
                <Link href="/auth" className="btn btn-outline" style={{ fontSize: "0.97rem", padding: "0.72rem 1.4rem" }}>
                  Register free
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right: terminal mockup */}
        <div className="hero-right">
          <div className="terminal-card">
            <div className="terminal-top">
              <div className="terminal-dot t-red" />
              <div className="terminal-dot t-yellow" />
              <div className="terminal-dot t-green" />
              <span className="terminal-title">usaco-judge — bash</span>
            </div>
            <div className="terminal-body">
              <div className="t-line"><span className="t-prompt">$</span><span className="t-cmd">submit --lang=cpp17 --problem=b1</span></div>
              <div className="t-blank" />
              <div className="t-line"><span className="t-pass">✓</span><span className="t-cmd"> Compiled successfully</span></div>
              <div className="t-line"><span className="t-pass">✓</span><span className="t-cmd"> Test 1/3 passed <span className="t-time">(0.012s)</span></span></div>
              <div className="t-line"><span className="t-pass">✓</span><span className="t-cmd"> Test 2/3 passed <span className="t-time">(0.009s)</span></span></div>
              <div className="t-line"><span className="t-pass">✓</span><span className="t-cmd"> Test 3/3 passed <span className="t-time">(0.011s)</span></span></div>
              <div className="t-blank" />
              <div className="t-line"><span className="t-score">  Score: 100 / 100  ━━━━━━━━━━━━━━  Accepted</span></div>
              <div className="t-blank" />
              <div className="t-line"><span className="t-promote">Promoted: Bronze → Silver</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Division track ── */}
      <section className="divisions-strip">
        <h2>Division Ladder</h2>
        <div className="divisions-track">
          {[
            { label: "Bronze", sub: "Start here", cls: "div-bronze" },
            { label: "Silver", sub: "Prefix sums, sets", cls: "div-silver" },
            { label: "Gold", sub: "DP, graphs", cls: "div-gold" },
            { label: "Platinum", sub: "Advanced algorithms", cls: "div-plat" },
          ].map((d) => (
            <div key={d.label} className="div-node">
              <div className={`div-badge ${d.cls}`}>{d.label}</div>
              <div className="div-label">{d.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features">
        <div className="feat-card">
          <Icon name="compiler" className="feat-icon" />
          <h3>Local Compiler</h3>
          <p>Code runs on your machine via gcc, g++, javac, and Python — no external API. Instant results, no rate limits.</p>
        </div>
        <div className="feat-card">
          <Icon name="editor" className="feat-icon" />
          <h3>Monaco Editor</h3>
          <p>The same editor powering VS Code. Syntax highlighting, auto-indent, and theme switching for every language.</p>
        </div>
        <div className="feat-card">
          <Icon name="shield" className="feat-icon" />
          <h3>Strict Judging</h3>
          <p>5-second time limit enforced per test. Output must match exactly — whitespace trimmed, lines normalized.</p>
        </div>
      </section>

      <section className="landing-rules">
        <h2>Past Competitions</h2>
        <p style={{ margin: "0 0 1rem", color: "var(--ink2)", fontSize: "0.92rem", lineHeight: 1.6 }}>
          Browse archived competition sets with problem statements, test data, and solution notes.
        </p>
        <Link href="/past-competitions" className="btn btn-outline">
          <Icon name="archive" className="icon" /> Open Archive
        </Link>
      </section>

      {/* ── Rules ── */}
      <section className="landing-rules">
        <h2>How it works</h2>
        <ul className="rules-list">
          <li>Register and start from <strong>Bronze</strong> division.</li>
          <li>Each contest gives you <strong>3 problems</strong> and a <strong>30-minute timer</strong>.</li>
          <li>Use <strong>Run</strong> to test against the sample, <strong>Submit</strong> to judge all test cases.</li>
          <li>Score is partial — you earn points for each test case passed.</li>
          <li>All 3 problems must score <strong>100/100</strong> to earn promotion to the next division.</li>
          <li>Supported: <strong>C, C++17, Java 11, Python 3</strong>.</li>
          <li>Contests are held every <strong>Friday</strong>.</li>
        </ul>
      </section>
    </>
  );
}
