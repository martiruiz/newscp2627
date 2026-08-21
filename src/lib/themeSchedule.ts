export const SCHEDULE_KEY = "scp-theme-schedule";

export interface ThemeSchedule {
  enabled: boolean;
  lightStart: string; // "HH:MM"
  lightEnd: string;   // "HH:MM"
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function isLightNow(sched: ThemeSchedule): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const ls = parseTime(sched.lightStart);
  const le = parseTime(sched.lightEnd);
  return ls < le ? cur >= ls && cur < le : cur >= ls || cur < le;
}

export function applyScheduledTheme(): boolean {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (!raw) return false;
    const sched: ThemeSchedule = JSON.parse(raw);
    if (!sched.enabled) return false;
    if (isLightNow(sched)) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "blue");
    }
    return true;
  } catch {
    return false;
  }
}
