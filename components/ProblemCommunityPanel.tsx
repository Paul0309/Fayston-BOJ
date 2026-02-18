"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Editorial = {
    id: string;
    title: string;
    content: string;
    isOfficial: number;
    createdAt: string;
    authorName: string | null;
};

type Discussion = {
    id: string;
    parentId?: string | null;
    content: string;
    likeCount?: number;
    likedByMe?: boolean;
    createdAt: string;
    authorName: string | null;
};

interface ProblemCommunityPanelProps {
    problemId: string;
    canPostDiscussion: boolean;
    isAdmin: boolean;
    editorials: Editorial[];
    discussions: Discussion[];
}

export default function ProblemCommunityPanel({
    problemId,
    canPostDiscussion,
    isAdmin,
    editorials,
    discussions
}: ProblemCommunityPanelProps) {
    const router = useRouter();
    const [discussion, setDiscussion] = useState("");
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [postingDiscussion, setPostingDiscussion] = useState(false);
    const [postingEditorial, setPostingEditorial] = useState(false);

    const { roots, childrenMap } = useMemo(() => {
        const rootsList = discussions.filter((d) => !d.parentId);
        const map = new Map<string, Discussion[]>();
        discussions.filter((d) => d.parentId).forEach((d) => {
            const pid = d.parentId as string;
            if (!map.has(pid)) map.set(pid, []);
            map.get(pid)?.push(d);
        });
        return { roots: rootsList, childrenMap: map };
    }, [discussions]);

    const submitDiscussion = async () => {
        if (!discussion.trim()) return;
        setPostingDiscussion(true);
        try {
            const res = await fetch(`/api/problem/${problemId}/discussion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: discussion, parentId: replyTo })
            });
            if (!res.ok) throw new Error(await res.text());
            setDiscussion("");
            setReplyTo(null);
            router.refresh();
        } catch (error) {
            alert(error instanceof Error ? error.message : "댓글 등록 실패");
        } finally {
            setPostingDiscussion(false);
        }
    };

    const submitEditorial = async () => {
        if (!title.trim() || !content.trim()) return;
        setPostingEditorial(true);
        try {
            const res = await fetch(`/api/problem/${problemId}/editorial`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content, isOfficial: true })
            });
            if (!res.ok) throw new Error(await res.text());
            setTitle("");
            setContent("");
            router.refresh();
        } catch (error) {
            alert(error instanceof Error ? error.message : "에디토리얼 등록 실패");
        } finally {
            setPostingEditorial(false);
        }
    };

    const likeDiscussion = async (discussionId: string) => {
        const res = await fetch(`/api/problem/discussion/${discussionId}/like`, { method: "POST" });
        if (res.ok) router.refresh();
    };

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
                <h2 className="text-lg font-bold text-neutral-100 mb-3">에디토리얼</h2>
                <div className="space-y-3">
                    {editorials.map((item) => (
                        <article key={item.id} className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold text-neutral-100">{item.title}</h3>
                                {item.isOfficial ? <span className="text-xs rounded bg-blue-900/50 text-blue-300 px-2 py-1">공식</span> : null}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-200">{item.content}</p>
                            <p className="mt-2 text-xs text-neutral-400">{item.authorName || "Unknown"} · {new Date(item.createdAt).toLocaleString()}</p>
                        </article>
                    ))}
                    {editorials.length === 0 ? <p className="text-sm text-neutral-300">아직 등록된 에디토리얼이 없습니다.</p> : null}
                </div>

                {isAdmin ? (
                    <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-950 p-4 space-y-2">
                        <div className="text-sm font-semibold text-neutral-200">관리자 에디토리얼 작성</div>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100" />
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="해설 내용" className="w-full min-h-28 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100" />
                        <button type="button" onClick={submitEditorial} disabled={postingEditorial} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                            {postingEditorial ? "등록 중..." : "에디토리얼 등록"}
                        </button>
                    </div>
                ) : null}
            </section>

            <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
                <h2 className="text-lg font-bold text-neutral-100 mb-3">토론</h2>
                {canPostDiscussion ? (
                    <div className="mb-4 space-y-2">
                        {replyTo ? (
                            <div className="text-xs text-blue-300">
                                답글 작성 중 · <button type="button" className="underline" onClick={() => setReplyTo(null)}>취소</button>
                            </div>
                        ) : null}
                        <textarea value={discussion} onChange={(e) => setDiscussion(e.target.value)} placeholder="문제 관련 질문/힌트를 남겨보세요" className="w-full min-h-24 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
                        <button type="button" onClick={submitDiscussion} disabled={postingDiscussion} className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                            {postingDiscussion ? "등록 중..." : "댓글 등록"}
                        </button>
                    </div>
                ) : (
                    <p className="mb-4 text-sm text-neutral-300">토론에 참여하려면 로그인하세요.</p>
                )}

                <div className="space-y-2">
                    {roots.map((item) => (
                        <article key={item.id} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3">
                            <p className="whitespace-pre-wrap text-sm text-neutral-200">{item.content}</p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                                <span>{item.authorName || "Unknown"} · {new Date(item.createdAt).toLocaleString()}</span>
                                <button type="button" className="hover:text-blue-300" onClick={() => likeDiscussion(item.id)}>
                                    좋아요 {item.likeCount || 0}
                                </button>
                                {canPostDiscussion ? (
                                    <button type="button" className="hover:text-blue-300" onClick={() => setReplyTo(item.id)}>
                                        답글
                                    </button>
                                ) : null}
                            </div>
                            {(childrenMap.get(item.id) || []).map((child) => (
                                <div key={child.id} className="mt-2 ml-4 rounded border border-neutral-800 bg-neutral-900 p-2">
                                    <p className="whitespace-pre-wrap text-sm text-neutral-200">{child.content}</p>
                                    <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                                        <span>{child.authorName || "Unknown"} · {new Date(child.createdAt).toLocaleString()}</span>
                                        <button type="button" className="hover:text-blue-300" onClick={() => likeDiscussion(child.id)}>
                                            좋아요 {child.likeCount || 0}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </article>
                    ))}
                    {roots.length === 0 ? <p className="text-sm text-neutral-300">아직 토론 글이 없습니다.</p> : null}
                </div>
            </section>
        </div>
    );
}
