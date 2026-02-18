"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import Icon from "../components/Icon";
import { STORAGE_KEYS } from "../../lib/constants";
import { PAST_COMPETITIONS } from "../../lib/pastCompetitions";

const readStorage = (key, fb) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fb;
  } catch {
    return fb;
  }
};

const medalByDivision = {
  Bronze: "bronze",
  Silver: "silver",
  Gold: "gold",
};

export default function PastCompetitionsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCompetition, setSelectedCompetition] = useState("");

  useEffect(() => {
    setCurrentUser(readStorage(STORAGE_KEYS.current, null));
  }, []);

  const competitionNames = [...new Set(PAST_COMPETITIONS.map((contest) => contest.competitionName || contest.title))];
  const visibleContests = PAST_COMPETITIONS.filter(
    (contest) => (contest.competitionName || contest.title) === selectedCompetition
  );

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo">&lt;/&gt; USACO School</Link>
          <div className="nav-links">
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/ranking" className="nav-link"><Icon name="trophy" className="icon" /> Ranking</Link>
            <Link href="/past-competitions" className="nav-link" style={{ color: "var(--blue)" }}>
              <Icon name="archive" className="icon" /> Past Competitions
            </Link>
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

      <main className="past-wrap">
        {!selectedCompetition ? (
          <section className="past-contest">
            <h2 className="past-title">Choose Competition Name</h2>
            <div className="past-competition-chooser">
              {competitionNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setSelectedCompetition(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="past-contest">
              <h2 className="past-title">{selectedCompetition}</h2>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedCompetition("")}>
                <Icon name="back" className="icon" /> Choose Another Competition
              </button>
            </section>

            {visibleContests.map((contest) => (
          <section key={contest.id} className="past-contest">
            <h2 className="past-title">
              <span className={`past-medal ${medalByDivision[contest.division] || "bronze"}`} />
              {contest.title}
            </h2>

            <ol className="past-problem-list">
              {contest.problems.map((problem) => (
                <li key={problem.id} className="past-problem-item">
                  <div className="past-problem-name">{problem.title}</div>
                  <div className="past-problem-links">
                    <Link className="btn btn-outline" href={`/past-competitions/${contest.id}?q=${problem.id}`}>
                      View question
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          </section>
            ))}
          </>
        )}
      </main>
    </>
  );
}
