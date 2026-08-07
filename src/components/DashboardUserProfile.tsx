"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function DashboardUserProfile() {
  const [profile, setProfile] = useState({ full: "", initials: "", company: "" });
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("scp-account-profile");
      if (stored) {
        const p = JSON.parse(stored);
        const first = (p.name || "").trim();
        const last = (p.surname || "").trim();
        const full = [first, last].filter(Boolean).join(" ");
        const initials = [first[0], last[0]].filter(Boolean).join("").toUpperCase() || "ME";
        setProfile({ full: full || "My Account", initials, company: (p.company || "").trim() });
      }
    } catch {}

    try {
      const storedPhoto = localStorage.getItem("scp-account-photo");
      if (storedPhoto) setPhoto(storedPhoto);
    } catch {}
  }, []);

  return (
    <Link
      href="/account"
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "7px 12px 7px 7px", borderRadius: 14,
          background: "var(--bg-card)", border: "1px solid var(--border-color)",
          cursor: "pointer", transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(31,41,55,0.4)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
      >
        {/* Avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
          background: "linear-gradient(135deg,#1F2937,#111827)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff",
        }}>
          {photo
            ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : profile.initials || "ME"}
        </div>

        {/* Name + company */}
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: 13, fontWeight: 700, margin: 0, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160,
            color: "var(--text-primary)",
          }}>
            {profile.full || "My Account"}
          </p>
          {profile.company && (
            <p style={{
              fontSize: 11, margin: "1px 0 0", color: "var(--text-muted)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160,
            }}>
              {profile.company}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
