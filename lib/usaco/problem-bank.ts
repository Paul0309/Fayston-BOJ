export type UsacoDivision = "Bronze" | "Silver" | "Gold" | "Platinum";

export type UsacoProblem = {
  id: string;
  title: string;
  difficulty: string;
  tags: string[];
  points: number;
  statement: string;
  inputDesc: string;
  outputDesc: string;
  sampleInput: string;
  sampleOutput: string;
  tests: Array<{ input: string; output: string }>;
};

export const USACO_QUESTION_BANK: Record<UsacoDivision, UsacoProblem[]> = {
  Bronze: [
    {
      id: "b1",
      title: "A+B",
      difficulty: "BRONZE_5",
      tags: ["math", "implementation"],
      points: 100,
      statement: "Given two integers A and B, print their sum.",
      inputDesc: "A single line containing two integers A and B separated by a space. (−10^9 <= A, B <= 10^9)",
      outputDesc: "Print A+B on a single line.",
      sampleInput: "1 2",
      sampleOutput: "3",
      tests: [
        { input: "1 2", output: "3" },
        { input: "4 9", output: "13" }
      ]
    },
    {
      id: "b2",
      title: "Max of Three",
      difficulty: "BRONZE_4",
      tags: ["math", "implementation"],
      points: 100,
      statement: "Given three integers, print the largest among them.",
      inputDesc: "A single line with three integers a, b, c. (-10^6 <= a, b, c <= 10^6)",
      outputDesc: "Print the maximum value.",
      sampleInput: "5 7 2",
      sampleOutput: "7",
      tests: [
        { input: "5 7 2", output: "7" },
        { input: "9 1 8", output: "9" }
      ]
    },
    {
      id: "b3",
      title: "Reverse String",
      difficulty: "BRONZE_3",
      tags: ["string", "implementation"],
      points: 100,
      statement: "Given a string, print it reversed.",
      inputDesc: "A single lowercase string s (1 <= |s| <= 100).",
      outputDesc: "Print the reverse of s.",
      sampleInput: "usaco",
      sampleOutput: "ocasu",
      tests: [
        { input: "abc", output: "cba" },
        { input: "racecar", output: "racecar" }
      ]
    }
  ],
  Silver: [
    {
      id: "s1",
      title: "Range Sum",
      difficulty: "SILVER_4",
      tags: ["prefix-sum", "implementation"],
      points: 100,
      statement:
        "Given an array of n integers and a query [l, r] (1-indexed), print the sum of elements from index l to r inclusive.",
      inputDesc: "First line: n. Second line: n integers. Third line: l r.",
      outputDesc: "Print the sum of elements from index l to r.",
      sampleInput: "5\n1 2 3 4 5\n2 4",
      sampleOutput: "9",
      tests: [
        { input: "5\n1 2 3 4 5\n2 4", output: "9" },
        { input: "4\n2 2 2 2\n1 4", output: "8" }
      ]
    },
    {
      id: "s2",
      title: "Count Evens",
      difficulty: "SILVER_5",
      tags: ["math", "implementation"],
      points: 100,
      statement: "Given n integers, count how many of them are even.",
      inputDesc: "First line: n. Second line: n integers.",
      outputDesc: "Print the count of even numbers.",
      sampleInput: "6\n1 2 3 4 5 6",
      sampleOutput: "3",
      tests: [
        { input: "6\n1 2 3 4 5 6", output: "3" },
        { input: "3\n1 3 5", output: "0" }
      ]
    },
    {
      id: "s3",
      title: "Sort Ascending",
      difficulty: "SILVER_3",
      tags: ["sorting", "implementation"],
      points: 100,
      statement: "Sort the given integers in non-decreasing order and print them on a single line.",
      inputDesc: "First line: n. Second line: n integers.",
      outputDesc: "Print the sorted sequence on one line, separated by spaces.",
      sampleInput: "5\n5 2 9 1 3",
      sampleOutput: "1 2 3 5 9",
      tests: [
        { input: "5\n5 2 9 1 3", output: "1 2 3 5 9" },
        { input: "4\n4 4 2 1", output: "1 2 4 4" }
      ]
    }
  ],
  Gold: [
    {
      id: "g1",
      title: "Fibonacci",
      difficulty: "GOLD_5",
      tags: ["dp", "math"],
      points: 100,
      statement: "Print the nth Fibonacci number, where fib(0)=0, fib(1)=1, fib(n)=fib(n-1)+fib(n-2).",
      inputDesc: "A single integer n (0 <= n <= 30).",
      outputDesc: "Print fib(n).",
      sampleInput: "7",
      sampleOutput: "13",
      tests: [
        { input: "7", output: "13" },
        { input: "10", output: "55" }
      ]
    },
    {
      id: "g2",
      title: "Distinct Count",
      difficulty: "GOLD_4",
      tags: ["data-structures", "implementation"],
      points: 100,
      statement: "Count the number of distinct values in the given sequence.",
      inputDesc: "First line: n. Second line: n integers.",
      outputDesc: "Print the number of unique values.",
      sampleInput: "6\n1 2 2 3 4 4",
      sampleOutput: "4",
      tests: [
        { input: "6\n1 2 2 3 4 4", output: "4" },
        { input: "5\n5 5 5 5 5", output: "1" }
      ]
    },
    {
      id: "g3",
      title: "Longest Word",
      difficulty: "GOLD_4",
      tags: ["string", "greedy"],
      points: 100,
      statement: "Given a line of words, print the longest word. If tied, print the first one.",
      inputDesc: "One line with space-separated words.",
      outputDesc: "Print the longest word.",
      sampleInput: "cow jumps over moon",
      sampleOutput: "jumps",
      tests: [
        { input: "cow jumps over moon", output: "jumps" },
        { input: "a bb ccc dd", output: "ccc" }
      ]
    }
  ],
  Platinum: [
    {
      id: "p1",
      title: "Palindrome Check",
      difficulty: "PLATINUM_5",
      tags: ["string", "two-pointers"],
      points: 100,
      statement: "Determine whether the given string is a palindrome. Print YES if it is, NO otherwise.",
      inputDesc: "One string s (1 <= |s| <= 1000, lowercase letters).",
      outputDesc: "YES or NO.",
      sampleInput: "racecar",
      sampleOutput: "YES",
      tests: [
        { input: "racecar", output: "YES" },
        { input: "abc", output: "NO" }
      ]
    },
    {
      id: "p2",
      title: "Diagonal Sum",
      difficulty: "PLATINUM_5",
      tags: ["math", "implementation", "matrix"],
      points: 100,
      statement: "Given an n x n matrix, compute the sum of its main diagonal.",
      inputDesc: "First line: n. Then n lines each with n integers.",
      outputDesc: "Print the diagonal sum.",
      sampleInput: "2\n1 2\n3 4",
      sampleOutput: "5",
      tests: [
        { input: "2\n1 2\n3 4", output: "5" },
        { input: "3\n1 0 0\n0 2 0\n0 0 3", output: "6" }
      ]
    },
    {
      id: "p3",
      title: "Character Frequency",
      difficulty: "PLATINUM_4",
      tags: ["string", "sorting", "hash-map"],
      points: 100,
      statement:
        "Given a lowercase string, print each character frequency in alphabetical order as c:count separated by spaces.",
      inputDesc: "One lowercase string (1 <= |s| <= 1000).",
      outputDesc: "Sorted c:count pairs separated by spaces.",
      sampleInput: "banana",
      sampleOutput: "a:3 b:1 n:2",
      tests: [
        { input: "banana", output: "a:3 b:1 n:2" },
        { input: "abc", output: "a:1 b:1 c:1" }
      ]
    }
  ]
};

export const USACO_DIVISIONS: UsacoDivision[] = ["Bronze", "Silver", "Gold", "Platinum"];

