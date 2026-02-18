"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdSenseUnit from "@/components/AdSenseUnit";

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/usaco")) return null;

  const adSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_FOOTER_SLOT;

  return (
    <footer className="border-t border-neutral-800 bg-neutral-900">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {adSlot ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
            <AdSenseUnit slot={adSlot} format="horizontal" />
          </div>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-neutral-400">© {new Date().getFullYear()} SchoolBOJ. All rights reserved.</div>
          <div className="flex items-center gap-4 text-sm text-neutral-300">
            <Link href="/problems" className="hover:text-blue-400">
              문제
            </Link>
            <Link href="/status" className="hover:text-blue-400">
              채점 현황
            </Link>
            <Link href="/rank" className="hover:text-blue-400">
              랭킹
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
