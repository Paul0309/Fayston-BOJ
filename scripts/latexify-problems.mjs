import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function transformPlain(text) {
    let t = text;

    t = t.replace(/Hello World!/g, "$\\texttt{Hello\\ World!}$");
    t = t.replace(/\bA\+B\+C\b/g, "$A+B+C$");
    t = t.replace(/\bA\+B\b/g, "$A+B$");
    t = t.replace(/\bA-B\b/g, "$A-B$");
    t = t.replace(/\bA\*B\b/g, "$A\\times B$");
    t = t.replace(/\bGCD\(([^)]+)\)/g, "$\\gcd($1)$");
    t = t.replace(/\bLCM\(([^)]+)\)/g, "$\\mathrm{lcm}($1)$");
    t = t.replace(/\[l,\s*r\]/g, "$[l, r]$");
    t = t.replace(/\(1,1\)/g, "$(1,1)$");
    t = t.replace(/\(N,M\)/g, "$(N,M)$");
    t = t.replace(/\b0\/1\b/g, "$0/1$");
    t = t.replace(/\bLIS\b/g, "$LIS$");

    t = t.replace(/\bYES\b/g, "$\\mathrm{YES}$");
    t = t.replace(/\bNO\b/g, "$\\mathrm{NO}$");
    t = t.replace(/\bEVEN\b/g, "$\\mathrm{EVEN}$");
    t = t.replace(/\bODD\b/g, "$\\mathrm{ODD}$");
    t = t.replace(/\bstart\b/g, "$start$");
    t = t.replace(/\bend\b/g, "$end$");
    t = t.replace(/\bu v w\b/g, "$u$ $v$ $w$");
    t = t.replace(/\bl r\b/g, "$l$ $r$");

    t = t.replace(/(^|[^A-Za-z0-9$])([A-Z])(?=[^A-Za-z0-9$]|$)/g, (m, p1, p2) => `${p1}$${p2}$`);
    return t;
}

function latexify(text) {
    if (!text) return text;
    const segments = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g);
    return segments
        .map((segment, idx) => (idx % 2 === 1 ? segment : transformPlain(segment)))
        .join("");
}

function hasLatex(text) {
    if (!text) return false;
    return /\$[^$]+\$|\$\$[\s\S]+?\$\$/.test(text);
}

async function main() {
    const problems = await prisma.problem.findMany({
        select: { id: true, number: true, title: true, description: true, inputDesc: true, outputDesc: true },
        orderBy: { number: "asc" }
    });

    const updates = [];
    for (const p of problems) {
        const description = latexify(p.description || "");
        const inputDesc = latexify(p.inputDesc || "");
        const outputDesc = latexify(p.outputDesc || "");

        if (
            description !== (p.description || "") ||
            inputDesc !== (p.inputDesc || "") ||
            outputDesc !== (p.outputDesc || "")
        ) {
            updates.push({ id: p.id, number: p.number, title: p.title, description, inputDesc, outputDesc });
        }
    }

    if (!APPLY) {
        console.log(`[dry-run] candidate updates: ${updates.length}/${problems.length}`);
        for (const item of updates.slice(0, 10)) {
            console.log("---");
            console.log(`${item.number} | ${item.title}`);
            console.log(`DESC: ${item.description}`);
            console.log(`IN  : ${item.inputDesc}`);
            console.log(`OUT : ${item.outputDesc}`);
        }
    } else {
        for (const item of updates) {
            await prisma.problem.update({
                where: { id: item.id },
                data: {
                    description: item.description,
                    inputDesc: item.inputDesc || null,
                    outputDesc: item.outputDesc || null
                }
            });
        }
        console.log(`[apply] updated ${updates.length} problems`);
    }

    const latest = await prisma.problem.findMany({
        select: { description: true, inputDesc: true, outputDesc: true }
    });
    const latexProblems = latest.filter(
        (p) => hasLatex(p.description) || hasLatex(p.inputDesc || "") || hasLatex(p.outputDesc || "")
    ).length;
    console.log(`latex coverage: ${latexProblems}/${latest.length}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
