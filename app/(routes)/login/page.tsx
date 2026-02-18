"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function LoginPage() {
    const router = useRouter();
    const [data, setData] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const callback = await signIn("credentials", { ...data, redirect: false });
            if (callback?.error) {
                setError("이메일 또는 비밀번호가 올바르지 않습니다.");
            } else if (callback?.ok) {
                router.push("/");
                router.refresh();
            }
        } catch {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 rounded-lg border border-neutral-700 bg-neutral-900 p-8 shadow-lg">
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-100">로그인</h2>
                    <p className="mt-2 text-sm text-neutral-200">계정에 로그인하여 서비스를 이용하세요.</p>
                </div>

                <form className="space-y-6" onSubmit={handleLogin}>
                    {error && <div className="bg-red-900/40 text-red-200 p-3 rounded text-sm text-center font-medium">{error}</div>}
                    <div>
                        <label className="block text-sm font-medium text-neutral-100">이메일</label>
                        <input
                            type="email"
                            required
                            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={data.email}
                            onChange={(e) => setData({ ...data, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-100">비밀번호</label>
                        <input
                            type="password"
                            required
                            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={data.password}
                            onChange={(e) => setData({ ...data, password: e.target.value })}
                        />
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        className={cn(
                            "w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors",
                            loading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {loading ? "로그인 중..." : "로그인"}
                    </button>
                </form>

                <div className="text-center text-sm text-neutral-200">
                    계정이 없으신가요? <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">회원가입</Link>
                </div>
            </div>
        </div>
    );
}
