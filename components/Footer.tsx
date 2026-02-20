"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdSenseUnit from "@/components/AdSenseUnit";

type FooterSection = {
  title: string;
  links: Array<{ href: string; label: string }>;
};

const footerSections: FooterSection[] = [
  {
    title: "Platform",
    links: [
      { href: "/problems", label: "Problems" },
      { href: "/status", label: "Status" },
      { href: "/rank", label: "Rankings" }
    ]
  },
  {
    title: "Practice",
    links: [
      { href: "/submit", label: "Submit" },
      { href: "/arena", label: "Arena Duel" },
      { href: "/profile", label: "Profile" }
    ]
  },
  {
    title: "USACO",
    links: [
      { href: "/usaco", label: "Home" },
      { href: "/usaco/contest", label: "Contest" },
      { href: "/usaco/ranking", label: "Ranking" }
    ]
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Login" },
      { href: "/register", label: "Register" }
    ]
  }
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/usaco")) return null;

  const isAdminPage = pathname?.startsWith("/admin");
  const adSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_FOOTER_SLOT;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-800 bg-neutral-900">
      <div className={isAdminPage ? "lg:pl-64" : ""}>
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <div className="space-y-6">
            {adSlot ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                <AdSenseUnit slot={adSlot} format="horizontal" />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {footerSections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{section.title}</h3>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="footer-link text-sm text-neutral-200 transition-colors hover:text-blue-400">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-800 pt-5 text-xs text-neutral-400 md:flex-row md:items-center md:justify-between">
              <p>(c) {currentYear} SchoolBOJ. All rights reserved.</p>
              <p className="text-neutral-500">Build skills by solving problems with focused feedback.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
