// Billing dates for SCP subscriptions (plain JS: used by the Edge Functions and by pipeline/tests/billing-dates.test.mjs).
//
// Rule: monthly subscriptions renew on the 1st of every month (business time zone Europe/Madrid). The anchor is the 1st
// at 12:00 Madrid time — never midnight: Stripe renews on the same UTC day-of-month and time, and midnight in Madrid is
// still the previous day in UTC (23:00 or 22:00), which would drift to the last day of the month across summer / winter
// time. Noon in Madrid is 10:00 or 11:00 UTC on the 1st all year round.
//
//   start = end of the free trial, or now when there is no trial
//   • start on any day but the 1st → billing_cycle_anchor = next 1st 12:00, prorations: a first invoice for the days
//     from start to the 1st (Stripe calculates it), then the full price every 1st
//   • start on the 1st before 12:00 → anchor = that same day 12:00, no prorations (a few hours free, full price at noon)
//   • start on the 1st from 12:00   → no anchor (Stripe anchors at the start, already the 1st), full price now
//   Yearly subscriptions renew on their anniversary (start date); the day-1 rule doesn't apply.
export const BUSINESS_TZ = "Europe/Madrid";
export const ANCHOR_HOUR = 12;
const DAY = 86400000;

// Local calendar parts of an instant in a time zone
export function zoned(date, tz = BUSINESS_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(date).reduce((o, p) => (p.type !== "literal" ? { ...o, [p.type]: Number(p.value) } : o), {});
  return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour, mi: parts.minute, s: parts.second };
}
// UTC instant of a local wall-clock time in a time zone (handles summer / winter time)
export function zonedTime(y, m, d, h = 0, mi = 0, tz = BUSINESS_TZ) {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let t = wall;
  for (let i = 0; i < 3; i++) {
    const z = zoned(new Date(t), tz);
    const diff = wall - Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi);
    if (!diff) break;
    t += diff;
  }
  return new Date(t);
}
const addMonths = (y, m, n) => { const k = y * 12 + (m - 1) + n; return { y: Math.floor(k / 12), m: (k % 12) + 1 }; };

// Next anchor (the 1st at 12:00 local) strictly after `from`
export function nextMonthlyAnchor(from, tz = BUSINESS_TZ, day = 1) {
  const z = zoned(from, tz);
  let c = zonedTime(z.y, z.m, day, ANCHOR_HOUR, 0, tz);
  if (c <= from) { const n = addMonths(z.y, z.m, 1); c = zonedTime(n.y, n.m, day, ANCHOR_HOUR, 0, tz); }
  return c;
}

// What to send to Stripe for a new subscription.
//   → { trialEnd: Date|null, anchor: Date|null, prorate: boolean, start: Date }
export function planBilling({ interval, trialDays = 0, now = new Date(), tz = BUSINESS_TZ, day = 1 }) {
  const trialEnd = trialDays > 0 ? new Date(now.getTime() + trialDays * DAY) : null;
  const start = trialEnd || now;
  if (interval !== "month") return { trialEnd, anchor: null, prorate: false, start };
  const z = zoned(start, tz);
  if (z.d === day) {
    if (z.h < ANCHOR_HOUR) return { trialEnd, anchor: zonedTime(z.y, z.m, day, ANCHOR_HOUR, 0, tz), prorate: false, start };
    return { trialEnd, anchor: null, prorate: false, start };
  }
  return { trialEnd, anchor: nextMonthlyAnchor(start, tz, day), prorate: true, start };
}

// Stripe-like monthly renewals from an anchor (same UTC day-of-month and time, clamped to the month's last day).
// Only used by the tests to check that every renewal lands on the 1st in Madrid.
export function stripeMonthlyRenewals(anchor, count) {
  const a = new Date(anchor), out = [];
  for (let i = 1; i <= count; i++) {
    const y = a.getUTCFullYear(), m = a.getUTCMonth() + i;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    out.push(new Date(Date.UTC(y, m, Math.min(a.getUTCDate(), last), a.getUTCHours(), a.getUTCMinutes(), a.getUTCSeconds())));
  }
  return out;
}

export const unix = (d) => (d ? Math.floor(d.getTime() / 1000) : undefined);
