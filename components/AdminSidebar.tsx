"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, Plus, Settings, Zap } from "lucide-react";

const menuItems = [
    { href: "/admin", label: "대시보드", icon: LayoutDashboard },
    { href: "/admin#problem-create", label: "문제 추가", icon: Plus },
    { href: "/admin/ai-management", label: "AI 관리", icon: Zap },
    { href: "/admin#monitoring", label: "시스템 모니터링", icon: Settings },
];

export default function AdminSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href.includes("#")) {
            return false;
        }
        return pathname === href;
    };

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-40 lg:hidden bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar */}
            <aside
                className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-neutral-900 border-r border-neutral-800 transform transition-transform duration-300 ease-in-out z-40 lg:translate-x-0 overflow-y-auto
                ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                {/* Menu Items */}
                <nav className="p-3 space-y-1">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition text-sm font-medium
                                ${
                                    active
                                        ? "bg-blue-500 text-white"
                                        : "text-neutral-300 hover:bg-neutral-800"
                                }`}
                            >
                                <Icon size={18} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
