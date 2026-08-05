"use client";

import { useState } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  time: string;
}

// Edit this array to add/remove notifications
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "New content available",
    message: "3 new posts match your saved filters.",
    read: false,
    time: "2h ago",
  },
  {
    id: "2",
    title: "Top Pick added",
    message: "A post from @gresiniracing was marked as Top Pick.",
    read: false,
    time: "5h ago",
  },
  {
    id: "3",
    title: "Weekly digest ready",
    message: "Your weekly sports content summary is ready.",
    read: true,
    time: "1d ago",
  },
];

export default function DashboardNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unread = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center rounded-xl transition-all hover:opacity-80"
        style={{
          width: 38,
          height: 38,
          background: "var(--bg-input)",
          border: "1px solid var(--border-color)",
          color: "var(--text-secondary)",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute top-1.5 right-1.5 rounded-full"
            style={{ width: 7, height: 7, background: "#ef4444" }}
          />
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div
            className="absolute right-0 mt-2 z-50 rounded-xl overflow-hidden"
            style={{
              width: 320,
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Notifications
                {unread > 0 && (
                  <span
                    className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    {unread}
                  </span>
                )}
              </span>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] hover:underline"
                  style={{ color: "#F5C542" }}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
                  No notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="w-full text-left px-4 py-3 transition-all hover:opacity-80"
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      background: n.read ? "transparent" : "rgba(200,144,40,0.04)",
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      {!n.read && (
                        <span
                          className="rounded-full shrink-0 mt-1.5"
                          style={{ width: 6, height: 6, background: "#F5C542" }}
                        />
                      )}
                      <div className={!n.read ? "" : "ml-3.5"}>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
                          {n.title}
                        </p>
                        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                          {n.message}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                          {n.time}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
