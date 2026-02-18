import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const fix = {
  2568: {
    title: "두 수의 합",
    description: "두 정수 A와 B가 주어질 때, A+B를 출력하시오.",
    inputDesc: "한 줄에 정수 A, B가 공백으로 주어진다. (0 < A, B < 100)",
    outputDesc: "A+B를 출력한다."
  },
  2569: {
    title: "세 수의 합",
    description: "세 정수 A, B, C가 주어질 때, A+B+C를 출력하시오.",
    inputDesc: "한 줄에 정수 A, B, C가 공백으로 주어진다. (0 <= A, B, C <= 1000)",
    outputDesc: "A+B+C를 출력한다."
  },
  2570: {
    title: "최댓값 찾기",
    description: "N개의 정수 중 최댓값을 출력하시오.",
    inputDesc: "첫 줄에 N, 둘째 줄에 N개의 정수가 주어진다.",
    outputDesc: "최댓값을 출력한다."
  },
  2571: {
    title: "짝수 개수",
    description: "주어진 수열에서 짝수의 개수를 출력하시오.",
    inputDesc: "첫 줄에 N, 둘째 줄에 N개의 정수가 주어진다.",
    outputDesc: "짝수의 개수를 출력한다."
  },
  2572: {
    title: "문자열 뒤집기",
    description: "문자열 S가 주어질 때, 이를 뒤집어 출력하시오.",
    inputDesc: "한 줄에 문자열 S가 주어진다. (공백 없음)",
    outputDesc: "문자열을 뒤집어 출력한다."
  },
  2573: {
    title: "구간 합 질의 1",
    description: "N개의 수와 M개의 질의가 주어진다. 각 질의 [l, r]에 대해 구간 합을 출력하시오.",
    inputDesc: "첫 줄에 N M, 둘째 줄에 N개의 정수, 이후 M줄에 l r이 주어진다. (1-indexed)",
    outputDesc: "각 질의의 구간 합을 한 줄에 하나씩 출력한다."
  },
  2574: {
    title: "괄호 문자열",
    description: "주어진 괄호 문자열이 올바른 괄호 문자열인지 판별하시오.",
    inputDesc: "한 줄에 괄호 문자열 S가 주어진다.",
    outputDesc: "올바르면 YES, 아니면 NO를 출력한다."
  },
  2575: {
    title: "빈도수 정렬",
    description: "수열을 빈도수 내림차순으로 정렬하시오. 빈도수가 같으면 값 오름차순으로 정렬한다.",
    inputDesc: "첫 줄에 N, 둘째 줄에 N개의 정수가 주어진다.",
    outputDesc: "정렬된 수열을 공백으로 구분해 출력한다."
  },
  2576: {
    title: "미로 최단거리",
    description: "0과 1로 이루어진 격자에서 (1,1)에서 (N,M)까지의 최단거리를 구하시오. 1은 이동 가능한 칸이다.",
    inputDesc: "첫 줄에 N M, 이후 N줄의 0/1 문자열이 주어진다.",
    outputDesc: "최단거리(칸 수)를 출력한다."
  },
  2577: {
    title: "회의실 배정 기초",
    description: "회의 시작/종료 시간이 주어질 때, 서로 겹치지 않게 선택할 수 있는 최대 회의 수를 구하시오.",
    inputDesc: "첫 줄에 N, 이후 N줄에 start end가 주어진다.",
    outputDesc: "최대 회의 수를 출력한다."
  },
  2578: {
    title: "최소 동전 개수",
    description: "동전 종류와 목표 금액 K가 주어질 때 필요한 최소 동전 개수를 구하시오. 만들 수 없으면 -1을 출력한다.",
    inputDesc: "첫 줄에 N K, 이후 N줄에 동전 가치가 주어진다.",
    outputDesc: "최소 동전 개수 또는 -1을 출력한다."
  },
  2579: {
    title: "가중치 최단경로",
    description: "양의 가중치 그래프에서 1번 정점에서 N번 정점까지의 최단거리를 구하시오.",
    inputDesc: "첫 줄에 N M, 이후 M줄에 u v w가 주어진다.",
    outputDesc: "최단거리를 출력하고, 도달할 수 없으면 -1을 출력한다."
  },
  2580: {
    title: "LIS 길이",
    description: "수열의 가장 긴 증가 부분 수열의 길이를 구하시오.",
    inputDesc: "첫 줄에 N, 둘째 줄에 N개의 정수가 주어진다.",
    outputDesc: "LIS 길이를 출력한다."
  },
  2581: {
    title: "벽 1회 파괴 최단경로",
    description: "0/1 격자에서 벽을 최대 1번 부술 수 있을 때 시작점에서 도착점까지의 최단거리를 구하시오.",
    inputDesc: "첫 줄에 N M, 이후 N줄의 0/1 문자열이 주어진다.",
    outputDesc: "최단거리를 출력하고, 불가능하면 -1을 출력한다."
  },
  2582: {
    title: "구간 최소값 질의",
    description: "N개의 수와 M개의 질의 [l, r]가 주어질 때 각 구간의 최소값을 출력하시오.",
    inputDesc: "첫 줄에 N M, 둘째 줄에 N개의 정수, 이후 M줄에 l r이 주어진다. (1-indexed)",
    outputDesc: "각 질의의 최소값을 한 줄에 하나씩 출력한다."
  }
};

async function main() {
  let updated = 0;
  for (const [num, data] of Object.entries(fix)) {
    await db.problem.update({ where: { number: Number(num) }, data });
    updated++;
  }

  const bad = await db.problem.count({
    where: {
      number: { gte: 2568, lte: 2582 },
      OR: [
        { title: { contains: "??" } },
        { description: { contains: "??" } },
        { inputDesc: { contains: "??" } },
        { outputDesc: { contains: "??" } }
      ]
    }
  });

  console.log(`updated=${updated}`);
  console.log(`bad=${bad}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
