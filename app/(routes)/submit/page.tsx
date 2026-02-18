import { db } from "@/lib/db";
import SubmitForm from "@/components/SubmitForm";
import { getAllowedLanguages } from "@/lib/language-settings";

export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SubmitPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const problemId = typeof searchParams.id === "string" ? searchParams.id : undefined;

    let problem = null;
    let firstSampleInput: string | undefined;
    if (problemId) {
        problem = await db.problem.findUnique({
            where: { id: problemId },
            include: {
                testCases: {
                    where: { isHidden: false },
                    orderBy: { id: "asc" },
                    take: 1
                }
            }
        });
        firstSampleInput = problem?.testCases?.[0]?.input || undefined;
    }

    const allowedLanguages = await getAllowedLanguages();

    return (
        <div className="container mx-auto py-6 px-4">
            <SubmitForm
                problemId={problemId}
                problemTitle={problem?.title}
                problemDesc={problem?.description}
                inputDesc={problem?.inputDesc || undefined}
                outputDesc={problem?.outputDesc || undefined}
                allowedLanguages={allowedLanguages}
                initialRunInput={firstSampleInput}
            />
        </div>
    );
}
