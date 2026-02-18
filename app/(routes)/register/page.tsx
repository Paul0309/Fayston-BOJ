"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
    const router = useRouter();
    const [data, setData] = useState({ name: "", email: "", password: "", division: "Bronze" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await axios.post("/api/register", data);
            alert("회원가입 성공!");
            router.push("/login");
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                setError(typeof error.response?.data === "string" ? error.response.data : "Something went wrong");
            } else {
                setError("Something went wrong");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 rounded-lg border border-neutral-700 bg-neutral-900 p-8 shadow-lg">
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-100">회원가입</h2>
                    <p className="mt-2 text-sm text-neutral-200">SchoolBOJ에 오신 것을 환영합니다.</p>
                </div>

                <form className="space-y-6" onSubmit={handleRegister}>
                    {error && <div className="bg-red-900/40 text-red-200 p-3 rounded text-sm text-center font-medium">{error}</div>}
                    <div>
                        <label className="block text-sm font-medium text-neutral-100">이름</label>
                        <input
                            type="text"
                            required
                            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={data.name}
                            onChange={(e) => setData({ ...data, name: e.target.value })}
                        />
                    </div>
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
                        <label className="block text-sm font-medium text-neutral-100">디비전</label>
                        <select
                            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={data.division}
                            onChange={(e) => setData({ ...data, division: e.target.value })}
                        >
                            <option value="Bronze">Bronze</option>
                            <option value="Silver">Silver</option>
                            <option value="Gold">Gold</option>
                            <option value="Platinum">Platinum</option>
                        </select>
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
                        {loading ? "가입 중..." : "가입하기"}
                    </button>
                </form>

                <div className="text-center text-sm text-neutral-200">
                    이미 계정이 있으신가요? <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">로그인</Link>
                </div>
            </div>
        </div>
    );
}
