"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSenseUnitProps {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
}

export default function AdSenseUnit({
  slot,
  format = "auto",
  className
}: AdSenseUnitProps) {
  const client = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

  useEffect(() => {
    if (!client) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error("AdSense render failed", error);
    }
  }, [client]);

  if (!client) return null;

  return (
    <ins
      className={`adsbygoogle block ${className || ""}`.trim()}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}

