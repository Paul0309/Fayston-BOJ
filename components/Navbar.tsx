"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code2, Trophy, BarChart3, LogOut, User, ShieldPlus, ChevronDown, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { getSessionUser } from "@/lib/session-user";

const PROBLEM_MENU: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: "문제",
    items: [
      { label: "전체 문제", href: "/problems" },
      { label: "최신 문제", href: "/problems?sort=newest" },
      { label: "많이 푼 문제", href: "/problems?sort=solved" },
      { label: "태그로 보기", href: "/problems?tag=math" }
    ]
  },
  {
    title: "내 학습",
    items: [
      { label: "해결한 문제", href: "/problems?status=SOLVED" },
      { label: "미해결 문제", href: "/problems?status=UNSOLVED" },
      { label: "채점 현황", href: "/status" },
      { label: "내 프로필", href: "/profile" }
    ]
  },
  {
    title: "난이도",
    items: [
      { label: "브론즈", href: "/problems?difficulty=BRONZE_3" },
      { label: "실버", href: "/problems?difficulty=SILVER_3" },
      { label: "골드", href: "/problems?difficulty=GOLD_3" },
      { label: "랭킹", href: "/rank" }
    ]
  }
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { role, division } = getSessionUser(session);
  const isUsaco = pathname?.startsWith("/usaco");
  const isUsacoContest = pathname?.startsWith("/usaco/contest");

  return (
    <nav className="border-b border-neutral-800 bg-neutral-900 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-400">
          <Code2 className="w-6 h-6" />
          <span>{isUsacoContest ? "SchoolBOJ | Contest" : "SchoolBOJ"}</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-200">
          <div className="relative group">
            <Link href="/problems" className="hover:text-blue-400 transition-colors flex items-center gap-1 py-5">
              <Code2 className="w-4 h-4" />
              문제 <ChevronDown className="w-4 h-4 opacity-80" />
            </Link>
            <div className="pointer-events-none opacity-0 translate-y-1 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150 absolute left-0 top-full w-[720px] rounded-xl border border-neutral-700 bg-neutral-900/95 backdrop-blur p-4 shadow-2xl">
              <div className="grid grid-cols-3 gap-4">
                {PROBLEM_MENU.map((section) => (
                  <div key={section.title} className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                    <div className="text-xs font-semibold tracking-wide text-neutral-400 mb-2">{section.title}</div>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="block rounded px-2 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-blue-300 transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Link href="/status" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            채점 현황
          </Link>
          <Link href="/rank" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <Trophy className="w-4 h-4" />
            랭킹
          </Link>
          <Link href="/arena" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <Swords className="w-4 h-4" />
            1v1 Arena
          </Link>
          <Link href="/usaco" className="hover:text-blue-400 transition-colors flex items-center gap-1">
            <Code2 className="w-4 h-4" />
            USACO
          </Link>

          {session ? (
            <Link href="/profile" className="hover:text-blue-400 transition-colors flex items-center gap-1">
              <User className="w-4 h-4" />
              프로필
            </Link>
          ) : null}

          {role === "ADMIN" ? (
            <Link href="/admin" className="hover:text-blue-400 transition-colors flex items-center gap-1">
              <ShieldPlus className="w-4 h-4" />
              관리자
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <div className="text-sm font-medium text-neutral-100 flex items-center gap-2">
                <User className="w-4 h-4" />
                {session.user?.name || "User"}
                {isUsacoContest ? <span className="usaco-main-division">{division || "Bronze"}</span> : null}
              </div>
              <button onClick={() => signOut()} className="p-2 text-neutral-200 hover:text-red-500 transition-colors" title="로그아웃">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={cn("px-4 py-2 rounded-md text-sm font-medium transition-colors", "bg-blue-600 text-white hover:bg-blue-700")}>
                로그인
              </Link>
              <Link href="/register" className="px-4 py-2 rounded-md text-sm font-medium border border-neutral-700 text-neutral-100 hover:bg-neutral-800 transition-colors">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>

      {isUsaco ? (
        <div className="usaco-subnav">
          <div className="usaco-subnav-inner">
            <div className="usaco-sub-left">{isUsacoContest ? `${division || "Bronze"} Contest` : "USACO"}</div>
            <div className="usaco-sub-links">
              <Link href="/usaco/contest">Contest</Link>
              <Link href="/usaco/ranking">Ranking</Link>
              <Link href="/usaco/past-competitions">Past Competitions</Link>
              <Link href="/profile">Profile</Link>
            </div>
            <div className="usaco-sub-right-spacer" />
          </div>
        </div>
      ) : null}
    </nav>
  );
}
