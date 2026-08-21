"use client";
import { useEffect } from "react";
import { applyScheduledTheme } from "@/lib/themeSchedule";

export default function ThemeScheduler() {
  useEffect(() => {
    applyScheduledTheme();
    const interval = setInterval(applyScheduledTheme, 60_000);
    return () => clearInterval(interval);
  }, []);
  return null;
}
