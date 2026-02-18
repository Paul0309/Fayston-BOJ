"use client";

import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import useContestState from "./hooks/useContestState";
import ProblemSidebar from "./components/ProblemSidebar";
import EditorArea from "./components/EditorArea";
import ResultOverlay from "./components/ResultOverlay";
import Icon from "../components/Icon";

// ─── Contest page ──────────────────────────────────────────────────────────────
// Thin shell that assembles the three panels and the navbar.
// All state and business logic live in useContestState.
export default function ContestPage() {
  const state = useContestState();
  const { currentUser, contest, selQ } = state;

  // Guard: hook effects always run, but we render nothing until data is ready
  if (!currentUser || !contest || contest.username !== currentUser.username || !selQ) {
    return null;
  }

  // Platinum-complete guard: user has already beaten every division.
  // They shouldn't see a contest — show a congratulations screen instead.
  if (currentUser.platinumComplete) {
    return (
      <>
        <nav className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="nav-logo">&lt;/&gt; USACO School</Link>
            <div className="nav-links">
              <Link href="/ranking" className="nav-link"><Icon name="trophy" className="icon" /> Ranking</Link>
              <Link href="/past-competitions" className="nav-link"><Icon name="archive" className="icon" /> Past Competitions</Link>
            </div>
            <div className="nav-right">
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <div className="champion-page">
          <div className="champion-card">
            <Icon name="trophy" size={64} style={{ color: "#fbbf24" }} />
            <h1 className="champion-card-title">You&apos;re a Champion!</h1>
            <p className="champion-card-sub">
              You have already completed <strong>all four divisions</strong> of USACO School.
              There are no more problems left for you to solve here.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/" className="btn btn-primary"><Icon name="home" className="icon" /> Home</Link>
              <Link href="/profile" className="btn btn-outline">View Profile</Link>
              <Link href="/ranking" className="btn btn-outline"><Icon name="trophy" className="icon" /> Ranking</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo">&lt;/&gt; USACO School</Link>

          <div className="nav-links">
            <span className="nav-link" style={{ cursor: "default", opacity: 0.5 }}>
              {contest.division} Contest
            </span>
            <Link href="/ranking" className="nav-link"><Icon name="trophy" className="icon" /> Ranking</Link>
            <Link href="/past-competitions" className="nav-link"><Icon name="archive" className="icon" /> Past Competitions</Link>
          </div>

          <div className="nav-right">
            <ThemeToggle />
            <Link href="/profile" className="btn btn-outline" style={{ fontSize: "0.82rem", padding: "0.35rem 0.7rem" }}>
              Profile
            </Link>
            <Link href="/" className="btn btn-outline" style={{ fontSize: "0.82rem", padding: "0.35rem 0.7rem" }}>
              Home
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Main layout: sidebar | editor ── */}
      <div className="contest-wrap">
        <ProblemSidebar
          contest={state.contest}
          selQ={state.selQ}
          setSelId={state.setSelId}
        />
        <EditorArea
          selQ={state.selQ}
          patchQ={state.patchQ}
          output={state.output}
          timerEnd={state.timerEnd}
          runBusy={state.runBusy}
          busyQ={state.busyQ}
          timeLeft={state.timeLeft}
          hydrated={state.hydrated}
          handleRun={state.handleRun}
          handleSubmit={state.handleSubmit}
        />
      </div>

      {/* ── Result overlay (promotion / time-up) ── */}
      <ResultOverlay
        allPerfect={state.allPerfect}
        timerEnd={state.timerEnd}
        showResult={state.showResult}
        currentUser={state.currentUser}
        contest={state.contest}
        exitContest={state.exitContest}
      />
    </>
  );
}
