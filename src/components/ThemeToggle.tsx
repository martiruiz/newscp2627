"use client";

import { useState, useEffect } from "react";

const THEME_KEY = "scp-theme";

export default function ThemeToggle() {
  const [isBlue, setIsBlue] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "blue") {
        setIsBlue(true);
        document.documentElement.setAttribute("data-theme", "blue");
      }
    } catch {}
  }, []);

  function toggle() {
    const next = !isBlue;
    setIsBlue(next);
    try {
      if (next) {
        document.documentElement.setAttribute("data-theme", "blue");
        localStorage.setItem(THEME_KEY, "blue");
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem(THEME_KEY);
      }
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      title={isBlue ? "Switch to white theme" : "Switch to blue theme"}
      className="flex items-center justify-center rounded-xl transition-all hover:opacity-80"
      style={{
        width: 38,
        height: 38,
        background: isBlue ? "#1D4ED8" : "var(--bg-input)",
        border: isBlue ? "1px solid #1D4ED8" : "1px solid var(--border-color)",
        color: isBlue ? "#fff" : "var(--text-secondary)",
      }}
    >
      {isBlue ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4"/>
          <path d="M3 12h1M20 12h1M12 3v1M12 20v1M5.64 5.64l.71.71M17.65 17.65l.71.71M5.64 18.36l.71-.71M17.65 6.35l.71-.71"/>
        </svg>
      )}
    </button>
  );
}
