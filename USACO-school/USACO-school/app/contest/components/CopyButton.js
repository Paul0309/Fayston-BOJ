"use client";

import { useState } from "react";

// ─── One-click clipboard copy with transient feedback ─────────────────────────
export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <button
      type="button"
      className={`btn-copy${copied ? " copied" : ""}`}
      onClick={handleClick}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
