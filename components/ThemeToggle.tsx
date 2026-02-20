"use client";

import { SunMoon } from "lucide-react";

type Theme = "dark" | "light";

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("theme-light") ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.classList.toggle("theme-dark", theme === "dark");
  root.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const toggleTheme = () => {
    const saved = localStorage.getItem("schoolboj-theme");
    const current: Theme = saved === "light" ? "light" : readTheme();
    const next: Theme = current === "dark" ? "light" : "dark";
    localStorage.setItem("schoolboj-theme", next);
    applyTheme(next);
    window.dispatchEvent(new Event("themechange"));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-700 text-neutral-200 transition-colors hover:bg-neutral-800"
      aria-label="라이트/다크 모드 전환"
      title="테마 전환"
    >
      <SunMoon className="h-4 w-4" />
    </button>
  );
}
