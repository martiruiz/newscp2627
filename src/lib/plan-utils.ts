export const FREE_SEARCH_LIMIT = 5;
export const TEST_PLAN_KEY = "scp-test-plan";

export function getEffectivePlan(apiData: { plan?: string; email?: string; superAdmin?: boolean }): {
  plan: string;
  isSuperAdmin: boolean;
} {
  const isSuperAdmin = apiData.superAdmin === true;
  if (isSuperAdmin) {
    const testPlan =
      typeof window !== "undefined"
        ? (localStorage.getItem(TEST_PLAN_KEY) ?? "pro")
        : "pro";
    return { plan: testPlan, isSuperAdmin: true };
  }
  return { plan: apiData.plan ?? "free", isSuperAdmin: false };
}

export function getFreeSearchUsage(): { count: number; date: string } {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem("scp-free-searches");
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; date: string };
      if (parsed.date === today) return parsed;
    }
  } catch {}
  return { count: 0, date: today };
}

export function incrementFreeSearch(): number {
  const today = new Date().toISOString().slice(0, 10);
  const current = getFreeSearchUsage();
  const newCount = current.date === today ? current.count + 1 : 1;
  try {
    localStorage.setItem("scp-free-searches", JSON.stringify({ count: newCount, date: today }));
  } catch {}
  return newCount;
}
