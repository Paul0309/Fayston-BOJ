import { db } from "@/lib/db";

export async function seedDatabase() {
  try {
    console.log("🌱 Seeding database...");

    // 1. Create admin user
    const adminUser = await db.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        email: "admin@example.com",
        name: "Admin",
        password: "admin123", // ⚠️ 개발 단계에서만 사용!
        role: "ADMIN",
      },
    });
    console.log("✅ Admin user created:", adminUser.email);

    // 2. Create test user
    const testUser = await db.user.upsert({
      where: { email: "user@example.com" },
      update: {},
      create: {
        email: "user@example.com",
        name: "Test User",
        password: "user123",
        role: "STUDENT",
      },
    });
    console.log("✅ Test user created:", testUser.email);

    // 3. Create sample problems
    const sampleProblems = [
      {
        number: 1,
        title: "A+B",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "두 정수 A와 B가 주어질 때, A+B를 출력하시오.",
        inputDesc: "첫 줄에 두 정수 A, B가 공백으로 주어진다.",
        outputDesc: "A+B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "1 1", output: "2", isHidden: false, score: 50, groupName: "sample" },
          { input: "2 3", output: "5", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 2,
        title: "빼기",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "두 정수 A와 B가 주어질 때, A-B를 출력하시오.",
        inputDesc: "첫 줄에 두 정수 A, B가 공백으로 주어진다.",
        outputDesc: "A-B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "5 3", output: "2", isHidden: false, score: 50, groupName: "sample" },
          { input: "10 2", output: "8", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 3,
        title: "곱하기",
        difficulty: "BRONZE_4",
        tags: "math,implementation",
        description: "두 정수 A와 B가 주어질 때, A×B를 출력하시오.",
        inputDesc: "첫 줄에 두 정수 A, B가 공백으로 주어진다.",
        outputDesc: "A×B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "2 3", output: "6", isHidden: false, score: 50, groupName: "sample" },
          { input: "4 5", output: "20", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 4,
        title: "나누기",
        difficulty: "BRONZE_4",
        tags: "math,implementation",
        description: "두 정수 A와 B가 주어질 때, A÷B의 몫을 출력하시오.",
        inputDesc: "첫 줄에 두 정수 A, B가 공백으로 주어진다.",
        outputDesc: "A÷B의 몫을 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "10 3", output: "3", isHidden: false, score: 50, groupName: "sample" },
          { input: "20 5", output: "4", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 2557,
        title: "Hello World",
        difficulty: "BRONZE_5",
        tags: "implementation,output",
        description: "Hello World!를 출력하시오.",
        inputDesc: "입력은 없다.",
        outputDesc: "Hello World!를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "", output: "Hello World!", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 1000,
        title: "A+B",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.",
        inputDesc: "첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)",
        outputDesc: "첫째 줄에 A+B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "1 2", output: "3", isHidden: false, score: 50, groupName: "sample" },
          { input: "9 8", output: "17", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 1001,
        title: "A-B",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "두 정수 A와 B를 입력받은 다음, A-B를 출력하는 프로그램을 작성하시오.",
        inputDesc: "첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)",
        outputDesc: "첫째 줄에 A-B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "3 2", output: "1", isHidden: false, score: 50, groupName: "sample" },
          { input: "10 5", output: "5", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 10998,
        title: "A×B",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "두 정수 A와 B를 입력받은 다음, A×B를 출력하는 프로그램을 작성하시오.",
        inputDesc: "첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)",
        outputDesc: "첫째 줄에 A×B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "1 2", output: "2", isHidden: false, score: 50, groupName: "sample" },
          { input: "9 9", output: "81", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 1008,
        title: "A/B",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "두 정수 A와 B를 입력받은 다음, A/B를 출력하는 프로그램을 작성하시오.",
        inputDesc: "첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)",
        outputDesc: "첫째 줄에 A/B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "1 3", output: "0.3333333333333333", isHidden: false, score: 50, groupName: "sample" },
          { input: "4 5", output: "0.8", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 10869,
        title: "사칙연산",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "두 자연수 A와 B가 주어진다. A+B, A-B, A×B, A/B, A%B를 출력하시오.",
        inputDesc: "두 자연수 A와 B가 주어진다. (1 ≤ A, B ≤ 10,000)",
        outputDesc: "다섯 줄에 걸쳐 결과를 순서대로 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "7 3", output: "10\n4\n21\n2\n1", isHidden: false, score: 100, groupName: "sample" },
        ],
      },
      {
        number: 10430,
        title: "나머지",
        difficulty: "BRONZE_5",
        tags: "math,modular-arithmetic",
        description: "(A+B)%C, ((A%C) + (B%C))%C, (A×B)%C, ((A%C) × (B%C))%C를 출력하시오.",
        inputDesc: "첫째 줄에 A, B, C가 순서대로 주어진다. (2 ≤ A, B, C ≤ 10000)",
        outputDesc: "문제에서 설명한 순서대로 네 값을 한 줄에 하나씩 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "5 8 4", output: "1\n1\n0\n0", isHidden: false, score: 100, groupName: "sample" },
        ],
      },
      {
        number: 2588,
        title: "곱셈",
        difficulty: "BRONZE_3",
        tags: "math,implementation",
        description: "(세 자리 수) × (세 자리 수) 계산 과정을 출력하시오.",
        inputDesc: "첫째 줄에 세 자리 수, 둘째 줄에 세 자리 수가 주어진다.",
        outputDesc: "셋째 줄부터 다섯째 줄까지 각 자리 곱 결과, 여섯째 줄에 최종 곱을 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "472\n385", output: "2360\n3776\n1416\n181720", isHidden: false, score: 100, groupName: "sample" },
        ],
      },
      {
        number: 18108,
        title: "1998년생인 내가 태국에서는 2541년생?!",
        difficulty: "BRONZE_5",
        tags: "math,implementation",
        description: "불기 연도를 서기 연도로 변환하시오.",
        inputDesc: "불기 연도 y가 주어진다. (1000 ≤ y ≤ 3000)",
        outputDesc: "서기 연도를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "2541", output: "1998", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 9498,
        title: "시험 성적",
        difficulty: "BRONZE_5",
        tags: "implementation,conditional",
        description: "점수를 입력받아 성적을 출력하시오.",
        inputDesc: "시험 점수(0~100)가 주어진다.",
        outputDesc: "90~100: A, 80~89: B, 70~79: C, 60~69: D, 나머지: F",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "100", output: "A", isHidden: false, score: 34, groupName: "sample" },
          { input: "75", output: "C", isHidden: true, score: 33, groupName: "main" },
          { input: "59", output: "F", isHidden: true, score: 33, groupName: "main" },
        ],
      },
      {
        number: 2753,
        title: "윤년",
        difficulty: "BRONZE_5",
        tags: "implementation,conditional",
        description: "연도가 주어졌을 때 윤년이면 1, 아니면 0을 출력하시오.",
        inputDesc: "연도(1~4000)가 주어진다.",
        outputDesc: "윤년이면 1, 아니면 0을 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          { input: "2000", output: "1", isHidden: false, score: 50, groupName: "sample" },
          { input: "1900", output: "0", isHidden: true, score: 50, groupName: "main" },
        ],
      },
      {
        number: 2739,
        title: "구구단",
        difficulty: "BRONZE_5",
        tags: "implementation,loop",
        description: "N을 입력받은 뒤, 구구단 N단을 출력하시오.",
        inputDesc: "첫째 줄에 N이 주어진다. (1 ≤ N ≤ 9)",
        outputDesc: "N*1부터 N*9까지를 한 줄에 하나씩 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [
          {
            input: "2",
            output: "2 * 1 = 2\n2 * 2 = 4\n2 * 3 = 6\n2 * 4 = 8\n2 * 5 = 10\n2 * 6 = 12\n2 * 7 = 14\n2 * 8 = 16\n2 * 9 = 18",
            isHidden: false,
            score: 100,
            groupName: "sample",
          },
        ],
      },
      {
        number: 10950,
        title: "A+B - 3",
        difficulty: "BRONZE_5",
        tags: "implementation,loop",
        description: "T개의 테스트 케이스에 대해 A+B를 출력하시오.",
        inputDesc: "첫째 줄에 테스트 케이스 개수 T, 이후 각 줄에 A와 B가 주어진다.",
        outputDesc: "각 테스트 케이스마다 A+B를 한 줄에 하나씩 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5\n1 1\n2 3\n3 4\n9 8\n5 2", output: "2\n5\n7\n17\n7", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 8393,
        title: "합",
        difficulty: "BRONZE_5",
        tags: "math,loop",
        description: "n이 주어졌을 때, 1부터 n까지 합을 출력하시오.",
        inputDesc: "첫째 줄에 n(1 ≤ n ≤ 10,000)이 주어진다.",
        outputDesc: "1부터 n까지 합을 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "3", output: "6", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 15552,
        title: "빠른 A+B",
        difficulty: "BRONZE_4",
        tags: "implementation,io,loop",
        description: "입출력 속도에 유의해 A+B를 출력하시오.",
        inputDesc: "첫째 줄에 테스트 개수 T, 이후 T줄에 A와 B가 주어진다.",
        outputDesc: "각 줄에 A+B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 512,
        testCases: [{ input: "5\n1 1\n12 34\n5 500\n40 60\n1000 1000", output: "2\n46\n505\n100\n2000", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 2741,
        title: "N 찍기",
        difficulty: "BRONZE_5",
        tags: "implementation,loop",
        description: "자연수 N이 주어졌을 때, 1부터 N까지 한 줄에 하나씩 출력하시오.",
        inputDesc: "첫째 줄에 100,000보다 작거나 같은 자연수 N이 주어진다.",
        outputDesc: "1부터 N까지 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5", output: "1\n2\n3\n4\n5", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 2742,
        title: "기찍 N",
        difficulty: "BRONZE_5",
        tags: "implementation,loop",
        description: "자연수 N이 주어졌을 때, N부터 1까지 한 줄에 하나씩 출력하시오.",
        inputDesc: "첫째 줄에 100,000보다 작거나 같은 자연수 N이 주어진다.",
        outputDesc: "N부터 1까지 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5", output: "5\n4\n3\n2\n1", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 11021,
        title: "A+B - 7",
        difficulty: "BRONZE_5",
        tags: "implementation,loop",
        description: "각 테스트 케이스마다 'Case #x: ' 형식으로 A+B를 출력하시오.",
        inputDesc: "첫째 줄에 T, 이후 T줄에 A와 B가 주어진다.",
        outputDesc: "각 테스트 케이스마다 Case #x: A+B를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5\n1 1\n2 3\n3 4\n9 8\n5 2", output: "Case #1: 2\nCase #2: 5\nCase #3: 7\nCase #4: 17\nCase #5: 7", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 11022,
        title: "A+B - 8",
        difficulty: "BRONZE_5",
        tags: "implementation,loop",
        description: "각 테스트 케이스마다 'Case #x: A + B = C' 형식으로 출력하시오.",
        inputDesc: "첫째 줄에 T, 이후 T줄에 A와 B가 주어진다.",
        outputDesc: "형식에 맞춰 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5\n1 1\n2 3\n3 4\n9 8\n5 2", output: "Case #1: 1 + 1 = 2\nCase #2: 2 + 3 = 5\nCase #3: 3 + 4 = 7\nCase #4: 9 + 8 = 17\nCase #5: 5 + 2 = 7", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 2438,
        title: "별 찍기 - 1",
        difficulty: "BRONZE_5",
        tags: "implementation,loop",
        description: "N이 주어졌을 때, 첫째 줄부터 N번째 줄까지 별을 출력하시오.",
        inputDesc: "첫째 줄에 N(1 ≤ N ≤ 100)이 주어진다.",
        outputDesc: "첫째 줄에는 별 1개, 둘째 줄에는 별 2개 ... N번째 줄에는 별 N개를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5", output: "*\n**\n***\n****\n*****", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 2439,
        title: "별 찍기 - 2",
        difficulty: "BRONZE_4",
        tags: "implementation,loop",
        description: "오른쪽 정렬된 별을 출력하시오.",
        inputDesc: "첫째 줄에 N(1 ≤ N ≤ 100)이 주어진다.",
        outputDesc: "오른쪽 기준으로 별이 정렬되도록 N줄 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5", output: "    *\n   **\n  ***\n ****\n*****", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 10871,
        title: "X보다 작은 수",
        difficulty: "BRONZE_5",
        tags: "implementation,array",
        description: "정수 N개로 이루어진 수열 A와 정수 X가 주어진다. A에서 X보다 작은 수를 모두 출력하시오.",
        inputDesc: "첫째 줄에 N과 X, 둘째 줄에 수열 A를 이루는 정수 N개가 주어진다.",
        outputDesc: "X보다 작은 수를 입력 순서대로 공백으로 구분해 출력한다.",
        timeLimit: 1000,
        memoryLimit: 256,
        testCases: [{ input: "10 5\n1 10 4 9 2 3 8 5 7 6", output: "1 4 2 3", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 2562,
        title: "최댓값",
        difficulty: "BRONZE_3",
        tags: "implementation,array",
        description: "9개의 서로 다른 자연수 중 최댓값과 그 위치를 출력하시오.",
        inputDesc: "총 9개의 자연수가 한 줄에 하나씩 주어진다.",
        outputDesc: "첫째 줄에 최댓값, 둘째 줄에 최댓값의 위치(1~9)를 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "3\n29\n38\n12\n57\n74\n40\n85\n61", output: "85\n8", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 8958,
        title: "OX퀴즈",
        difficulty: "BRONZE_2",
        tags: "implementation,string",
        description: "연속된 O의 개수에 따라 점수를 계산하시오.",
        inputDesc: "첫째 줄에 테스트 케이스 개수, 이후 각 줄에 OX 문자열이 주어진다.",
        outputDesc: "각 테스트 케이스 점수를 한 줄에 하나씩 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "5\nOOXXOXXOOO\nOOXXOOXXOO\nOXOXOXOXOXOXOX\nOOOOOOOOOO\nOOOOXOOOOXOOOOX", output: "10\n9\n7\n55\n30", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 4344,
        title: "평균은 넘겠지",
        difficulty: "BRONZE_1",
        tags: "math,array",
        description: "학생들의 점수 평균을 넘는 학생 비율을 구하시오.",
        inputDesc: "첫째 줄에 테스트 케이스 C, 이후 각 테스트 케이스는 학생 수 N과 N개의 점수로 이루어진다.",
        outputDesc: "각 테스트 케이스마다 평균을 넘는 학생의 비율을 소수점 셋째 자리까지 출력한다.",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "1\n5 50 50 70 80 100", output: "40.000%", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 10171,
        title: "고양이",
        difficulty: "BRONZE_5",
        tags: "implementation,output",
        description: "아래 예제와 같이 고양이를 출력하시오.",
        inputDesc: "입력은 없다.",
        outputDesc: "\\    /\\\n )  ( ')\n(  /  )\n \\(__)|",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "", output: "\\    /\\\n )  ( ')\n(  /  )\n \\(__)|", isHidden: false, score: 100, groupName: "sample" }],
      },
      {
        number: 10172,
        title: "개",
        difficulty: "BRONZE_5",
        tags: "implementation,output",
        description: "아래 예제와 같이 개를 출력하시오.",
        inputDesc: "입력은 없다.",
        outputDesc: "|\\_/|\n|q p|   /}\n( 0 )\"\"\"\\\n|\"^\"`    |\n||_/=\\\\__|",
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: [{ input: "", output: "|\\_/|\n|q p|   /}\n( 0 )\"\"\"\\\n|\"^\"`    |\n||_/=\\\\__|", isHidden: false, score: 100, groupName: "sample" }],
      },
    ];

    for (const problemData of sampleProblems) {
      const { testCases, ...problemInfo } = problemData;
      const problem = await db.problem.upsert({
        where: { number: problemData.number },
        update: {},
        create: {
          ...problemInfo,
          testCases: {
            create: testCases,
          },
        },
      });
      console.log("✅ Problem created:", `#${problem.number} - ${problem.title}`);
    }

    // 4. Set allowed languages
    const languages = ["cpp", "python3", "java", "javascript"];
    for (const lang of languages) {
      await db.platformSetting.upsert({
        where: { key: `allowed_language_${lang}` },
        update: {},
        create: {
          key: `allowed_language_${lang}`,
          value: "true",
        },
      });
    }
    console.log("✅ Languages configured");

    // 5. Create automation schedules
    await db.automationSchedule.upsert({
      where: { type: "AI_REVIEW" },
      update: {},
      create: {
        type: "AI_REVIEW",
        enabled: true,
        cronExpression: "0 */6 * * *",
        presetLabel: "every6hours",
        config: JSON.stringify({
          limit: 30,
          retryErrors: true,
          force: false,
        }),
      },
    });

    await db.automationSchedule.upsert({
      where: { type: "AUTO_PROBLEM_GEN" },
      update: {},
      create: {
        type: "AUTO_PROBLEM_GEN",
        enabled: false,
        cronExpression: "0 10 * * *",
        presetLabel: "daily10am",
        config: JSON.stringify({
          limit: 1,
        }),
      },
    });
    console.log("✅ Automation schedules created");

    console.log("\n✨ Database seeding completed!");
    return true;
  } catch (error) {
    console.error("❌ Seeding error:", error);
    return false;
  }
}
