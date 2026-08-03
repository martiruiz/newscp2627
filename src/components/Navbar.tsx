"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center justify-between px-6 py-3 border-b"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
    >
      <Link href="/feed" className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Sports Content Playbook
      </Link>
      <div className="flex gap-4">
        <Link
          href="/feed"
          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{
            background: pathname === "/feed" ? "var(--accent-blue)" : "transparent",
            color: pathname === "/feed" ? "#fff" : "var(--text-secondary)",
          }}
        >
          Feed
        </Link>
        <Link
          href="/admin/import"
          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{
            background: pathname?.startsWith("/admin") ? "var(--accent-blue)" : "transparent",
            color: pathname?.startsWith("/admin") ? "#fff" : "var(--text-secondary)",
          }}
        >
          Import
        </Link>
      </div>
    </nav>
  );
}
