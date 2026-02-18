import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
    const existingProblem = await prisma.problem.findFirst({ where: { title: 'A+B' } })
    if (!existingProblem) {
        await prisma.problem.create({
            data: {
                number: 1000,
                title: 'A+B',
                description: '두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.',
                inputDesc: '첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)',
                outputDesc: '첫째 줄에 A+B를 출력한다.',
                timeLimit: 1000,
                memoryLimit: 128,
                testCases: {
                    create: [
                        { input: '1 2', output: '3', isHidden: false },
                        { input: '9 8', output: '17', isHidden: true },
                    ]
                }
            }
        })
        console.log('Seeded A+B Problem')
    }

    const p1001 = await prisma.problem.findUnique({ where: { number: 1001 } });
    if (!p1001) {
        await prisma.problem.create({
            data: {
                number: 1001,
                title: 'A-B',
                description: '두 정수 A와 B를 입력받은 다음, A-B를 출력하는 프로그램을 작성하시오.',
                inputDesc: '첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)',
                outputDesc: '첫째 줄에 A-B를 출력한다.',
                timeLimit: 1000,
                memoryLimit: 128,
                testCases: {
                    create: [
                        { input: '3 2', output: '1', isHidden: false },
                        { input: '10 5', output: '5', isHidden: true },
                    ]
                }
            }
        });
        console.log('Seeded A-B Problem');
    }

    const p1008 = await prisma.problem.findUnique({ where: { number: 1008 } });
    if (!p1008) {
        await prisma.problem.create({
            data: {
                number: 1008,
                title: 'A/B',
                description: '두 정수 A와 B를 입력받은 다음, A/B를 출력하는 프로그램을 작성하시오.',
                inputDesc: '첫째 줄에 A와 B가 주어진다. (0 < A, B < 10)',
                outputDesc: '첫째 줄에 A/B를 출력한다. 실제 정답과 출력값의 절대오차 또는 상대오차가 10^-9 이하이면 정답이다.',
                timeLimit: 1000,
                memoryLimit: 128,
                testCases: {
                    create: [
                        { input: '1 3', output: '0.33333333333333333333333333333333', isHidden: false },
                        { input: '4 5', output: '0.8', isHidden: true },
                    ]
                }
            }
        });
        console.log('Seeded A/B Problem');
    }

    const p2557 = await prisma.problem.findUnique({ where: { number: 2557 } });
    if (!p2557) {
        await prisma.problem.create({
            data: {
                number: 2557,
                title: 'Hello World',
                description: 'Hello World!를 출력하시오.',
                inputDesc: '없음',
                outputDesc: 'Hello World!를 출력하시오.',
                timeLimit: 1000,
                memoryLimit: 128,
                testCases: {
                    create: [
                        { input: '', output: 'Hello World!', isHidden: false },
                    ]
                }
            }
        });
        console.log('Seeded Hello World Problem');
    }

    const p2739 = await prisma.problem.findUnique({ where: { number: 2739 } });
    if (!p2739) {
        await prisma.problem.create({
            data: {
                number: 2739,
                title: '구구단',
                description: 'N을 입력받은 뒤, 구구단 N단을 출력하는 프로그램을 작성하시오. 출력 형식에 맞춰서 출력하면 된다.',
                inputDesc: '첫째 줄에 N이 주어진다. N은 1보다 크거나 같고, 9보다 작거나 같다.',
                outputDesc: '첫째 줄부터 아홉 번째 줄까지 N*1 ~ N*9를 출력한다.',
                timeLimit: 1000,
                memoryLimit: 128,
                testCases: {
                    create: [
                        {
                            input: '2',
                            output: '2 * 1 = 2\n2 * 2 = 4\n2 * 3 = 6\n2 * 4 = 8\n2 * 5 = 10\n2 * 6 = 12\n2 * 7 = 14\n2 * 8 = 16\n2 * 9 = 18',
                            isHidden: false
                        },
                    ]
                }
            }

        });
        console.log('Seeded Multiplication Problem');
    }

    const existingUser = await prisma.user.findUnique({ where: { id: 'temp-user-id' } })
    if (!existingUser) {
        await prisma.user.create({
            data: {
                id: 'temp-user-id',
                email: 'test@example.com',
                name: 'Test User',
                password: 'password123', // In real app, hash this
                role: 'STUDENT'
            }
        })
        console.log('Seeded Test User')
    }
}
main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect())
