"use client";

import { DIVISIONS } from "../../../lib/contest";
import Icon from "../../components/Icon";

// ─── Full-screen overlay shown when the contest ends (all perfect or time up) ──
export default function ResultOverlay({
  allPerfect,
  timerEnd,
  showResult,
  currentUser,
  contest,
  exitContest,
}) {
  const visible = showResult || (timerEnd && !allPerfect);
  if (!visible) return null;

  const isTopDivision = currentUser.division === DIVISIONS[DIVISIONS.length - 1];
  const nextDivision  = DIVISIONS[DIVISIONS.indexOf(currentUser.division) + 1];

  return (
    <div className="result-overlay">
      <div className="result-card">

        {allPerfect ? (
          isTopDivision ? (
            /* ── Platinum champion ─────────────────────────────────────────── */
            <>
              <h2 style={{ color: "#fbbf24", fontSize: "1.7rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                <Icon name="trophy" className="icon" />
                Champion!
              </h2>
              <p style={{ lineHeight: 1.7 }}>
                You&apos;ve conquered <strong>all four divisions</strong> and scored
                100/100 on every problem.<br />
                You have officially mastered USACO School.
              </p>
              <div className="result-btns">
                <button className="btn btn-primary" type="button" onClick={() => exitContest(true)}>
                  Finish
                </button>
              </div>
            </>
          ) : (
            /* ── Normal promotion ──────────────────────────────────────────── */
            <>
              <h2 style={{ color: "var(--green)" }}>Congratulations!</h2>
              <p>
                You scored 100/100 on all 3 problems.<br />
                Accept your promotion to <strong>{nextDivision}</strong>?
              </p>
              <div className="result-btns">
                <button className="btn btn-primary" type="button" onClick={() => exitContest(true)}>
                  Accept Promotion
                </button>
                <button className="btn btn-danger" type="button" onClick={() => exitContest(false)}>
                  Decline
                </button>
              </div>
            </>
          )
        ) : (
          /* ── Time expired ────────────────────────────────────────────────── */
          <>
            <h2>Time&apos;s Up</h2>
            <p>
              {contest.questions.filter((q) => q.score === 100).length}/3 problems solved.
              <br />Keep practicing and try again!
            </p>
            <div className="result-btns">
              <button className="btn btn-primary" type="button" onClick={() => exitContest(false)}>
                Exit Contest
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
