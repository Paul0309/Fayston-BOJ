import { CODE_TEMPLATES } from "./templates";

export const PAST_COMPETITIONS = [
  {
    id: "2024-dec-gold",
    competitionName: "2024 December 2nd Week",
    title: "USACO 2024 December Contest, Gold",
    division: "Gold",
    summary:
      "The gold division had 1012 total participants, of whom 697 were pre-college students. All competitors with certified scores of 700 or higher on this contest are automatically promoted to the platinum division.",
    problems: [
      {
        id: "cowdependence",
        title: "Cowdependence",
        difficulty: "GOLD_2",
        tags: ["graph", "scc"],
        statement:
          "Given dependency edges between cows, count how many strongly connected groups are independent roots in the condensed graph.",
        inputDesc: "First line N M, followed by M directed edges u v.",
        outputDesc: "Print the number of SCCs with indegree 0 in the SCC-DAG.",
        sampleInput: "5 4\n1 2\n2 1\n3 4\n4 5",
        sampleOutput: "2",
        tests: [
          { input: "5 4\n1 2\n2 1\n3 4\n4 5", output: "2" },
          { input: "3 3\n1 2\n2 3\n3 1", output: "1" },
        ],
        testData: ["5 4\n1 2\n2 1\n3 4\n4 5", "3 3\n1 2\n2 3\n3 1"],
        solution:
          "Run Kosaraju/Tarjan to find SCCs, build SCC indegrees, then count SCC components with indegree 0.",
      },
      {
        id: "interstellar-intervals",
        title: "Interstellar Intervals",
        difficulty: "GOLD_2",
        tags: ["interval", "dp"],
        statement:
          "Given weighted intervals, choose a non-overlapping subset with maximum total weight.",
        inputDesc: "First line N, then N lines of l r w.",
        outputDesc: "Print the maximum achievable total weight.",
        sampleInput: "4\n1 3 5\n2 5 6\n4 6 5\n6 8 4",
        sampleOutput: "10",
        tests: [
          { input: "4\n1 3 5\n2 5 6\n4 6 5\n6 8 4", output: "10" },
          { input: "3\n1 2 4\n3 4 7\n2 5 10", output: "11" },
        ],
        testData: ["4\n1 3 5\n2 5 6\n4 6 5\n6 8 4", "3\n1 2 4\n3 4 7\n2 5 10"],
        solution:
          "Sort by right endpoint and do weighted-interval DP with binary search predecessor lookup.",
      },
      {
        id: "job-completion",
        title: "Job Completion",
        difficulty: "GOLD_3",
        tags: ["greedy", "schedule"],
        statement:
          "Given jobs with durations and deadlines, maximize number of jobs that finish by deadline.",
        inputDesc: "First line N, then N lines duration deadline.",
        outputDesc: "Print the maximum number of jobs that can be completed on time.",
        sampleInput: "5\n2 4\n1 2\n3 8\n2 7\n1 6",
        sampleOutput: "4",
        tests: [
          { input: "5\n2 4\n1 2\n3 8\n2 7\n1 6", output: "4" },
          { input: "3\n3 3\n2 2\n1 2", output: "2" },
        ],
        testData: ["5\n2 4\n1 2\n3 8\n2 7\n1 6", "3\n3 3\n2 2\n1 2"],
        solution:
          "Sort by deadline, greedily keep chosen jobs in a max-heap by duration and drop longest when overtime.",
      },
    ],
  },
  {
    id: "2024-dec-silver",
    competitionName: "2024 December 2nd Week",
    title: "USACO 2024 December Contest, Silver",
    division: "Silver",
    summary:
      "The silver division had 4656 total participants, of whom 3410 were pre-college students. All competitors who scored 700 or higher on this contest are automatically promoted to the gold division.",
    problems: [
      {
        id: "cake-game",
        title: "Cake Game",
        difficulty: "SILVER_2",
        tags: ["dp", "interval"],
        statement:
          "Two players alternately take a cake piece from either end. Compute optimal score difference for first player.",
        inputDesc: "First line N, second line N integers.",
        outputDesc: "Print max(first - second) with optimal play.",
        sampleInput: "6\n4 7 2 9 5 2",
        sampleOutput: "3",
        tests: [
          { input: "6\n4 7 2 9 5 2", output: "3" },
          { input: "4\n1 2 3 4", output: "2" },
        ],
        testData: ["6\n4 7 2 9 5 2", "4\n1 2 3 4"],
        solution:
          "Use interval DP where dp[l][r] = max(a[l]-dp[l+1][r], a[r]-dp[l][r-1]).",
      },
      {
        id: "deforestation",
        title: "Deforestation",
        difficulty: "SILVER_2",
        tags: ["two pointers", "prefix sum"],
        statement:
          "Given heights and budget B, find longest contiguous segment whose removal cost is at most B.",
        inputDesc: "First line N B, second line N heights.",
        outputDesc: "Print maximum segment length.",
        sampleInput: "7 8\n3 1 4 1 5 1 1",
        sampleOutput: "5",
        tests: [
          { input: "7 8\n3 1 4 1 5 1 1", output: "5" },
          { input: "5 3\n2 2 2 2 2", output: "1" },
        ],
        testData: ["7 8\n3 1 4 1 5 1 1", "5 3\n2 2 2 2 2"],
        solution:
          "Maintain sliding window sum <= B with two pointers and maximize window length.",
      },
      {
        id: "2d-conveyor-belt",
        title: "2D Conveyor Belt",
        difficulty: "SILVER_3",
        tags: ["graph", "simulation"],
        statement:
          "On a grid of directions, each cell points to next cell. Count cells that eventually leave grid.",
        inputDesc: "R C followed by R strings of length C from {U,D,L,R}.",
        outputDesc: "Print number of cells that escape the grid.",
        sampleInput: "3 3\nRRD\nULL\nUUR",
        sampleOutput: "5",
        tests: [
          { input: "3 3\nRRD\nULL\nUUR", output: "5" },
          { input: "2 2\nRR\nLL", output: "0" },
        ],
        testData: ["3 3\nRRD\nULL\nUUR", "2 2\nRR\nLL"],
        solution:
          "DFS with 3-state marking (unseen/visiting/done) to detect cycles and escape paths.",
      },
    ],
  },
  {
    id: "2024-dec-bronze",
    competitionName: "2024 December 2nd Week",
    title: "USACO 2024 December Contest, Bronze",
    division: "Bronze",
    summary:
      "The bronze division had 11472 total participants, of whom 8373 were pre-college students. All competitors who scored 700 or higher on this contest are automatically promoted to the silver division.",
    problems: [
      {
        id: "roundabout-rounding",
        title: "Roundabout Rounding",
        difficulty: "BRONZE_2",
        tags: ["math", "implementation"],
        statement:
          "Given integer N, apply repeated nearest-10 rounding until one digit remains. Output final value.",
        inputDesc: "Single integer N (1 <= N <= 10^9).",
        outputDesc: "Print resulting one-digit value.",
        sampleInput: "157",
        sampleOutput: "2",
        tests: [
          { input: "157", output: "2" },
          { input: "44", output: "4" },
        ],
        testData: ["157", "44"],
        solution:
          "Iteratively round x/10 with standard half-up rules until x < 10.",
      },
      {
        id: "farmer-johns-cheese-block",
        title: "Farmer John's Cheese Block",
        difficulty: "BRONZE_3",
        tags: ["simulation"],
        statement:
          "A 3D cheese block has dimensions A B C. After each axis cut, reduce that dimension by 1 (min 0). Output remaining volume.",
        inputDesc: "A B C Q, then Q lines each one of X/Y/Z.",
        outputDesc: "After each cut, print current volume.",
        sampleInput: "2 3 4 3\nX\nY\nZ",
        sampleOutput: "12\n8\n4",
        tests: [
          { input: "2 3 4 3\nX\nY\nZ", output: "12\n8\n4" },
          { input: "1 1 2 2\nZ\nZ", output: "1\n0" },
        ],
        testData: ["2 3 4 3\nX\nY\nZ", "1 1 2 2\nZ\nZ"],
        solution:
          "Maintain mutable dimensions a,b,c and after each cut decrement chosen axis then print a*b*c.",
      },
      {
        id: "its-mooing-time",
        title: "It's Moo'in Time",
        difficulty: "BRONZE_2",
        tags: ["string"],
        statement:
          "Count occurrences of substring 'moo' in the given string.",
        inputDesc: "One lowercase string S.",
        outputDesc: "Print the number of indices i where S[i..i+2] == 'moo'.",
        sampleInput: "mooomoo",
        sampleOutput: "2",
        tests: [
          { input: "mooomoo", output: "2" },
          { input: "abc", output: "0" },
        ],
        testData: ["mooomoo", "abc"],
        solution:
          "Scan all length-3 windows and count exact matches to 'moo'.",
      },
    ],
  },
];

export function getPastContest(contestId) {
  return PAST_COMPETITIONS.find((contest) => contest.id === contestId) || null;
}

export function getPastProblem(contestId, problemId) {
  const contest = getPastContest(contestId);
  if (!contest) return null;
  const problem = contest.problems.find((item) => item.id === problemId) || null;
  if (!problem) return null;
  return { contest, problem };
}

export function makePastPracticeContest(contestId) {
  const contest = getPastContest(contestId);
  if (!contest) return null;

  return {
    id: contest.id,
    title: contest.title,
    division: contest.division,
    selectedId: contest.problems[0]?.id || "",
    questions: contest.problems.map((problem) => ({
      ...problem,
      language: "python",
      code: CODE_TEMPLATES.python,
      runInput: problem.sampleInput || "",
      submitted: false,
      score: 0,
      status: "Not submitted",
      submissionLogs: [],
    })),
  };
}
