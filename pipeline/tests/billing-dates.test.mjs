// Day-1 billing rule (supabase/functions/_shared/billing-dates.js): anchors and renewals in Europe/Madrid.
//   cd pipeline && npm run test:billing-dates
// This checks the dates SCP sends to Stripe. The prorated amounts are calculated by Stripe itself
// (validated with Stripe test clocks: node stripe/test-clocks.mjs, needs a test key).
import { planBilling, nextMonthlyAnchor, stripeMonthlyRenewals, zoned } from "../../supabase/functions/_shared/billing-dates.js";

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };
const madrid = (iso) => { const z = zoned(new Date(iso)); return `${z.y}-${String(z.m).padStart(2, "0")}-${String(z.d).padStart(2, "0")} ${String(z.h).padStart(2, "0")}:${String(z.mi).padStart(2, "0")}`; };
const local = (d) => d && madrid(d.toISOString());
// a Madrid wall-clock time → Date
const at = (s) => { const [d, t = "10:00"] = s.split(" "); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number);
  for (let off = -3; off <= 3; off++) { const c = new Date(Date.UTC(y, m - 1, dd, h - off, mi)); if (madrid(c.toISOString()) === `${d} ${t.padStart(5, "0")}`) return c; } throw new Error(s); };

console.log("\nThe example: subscribe 10 Nov, 7-day trial");
let b = planBilling({ interval: "month", trialDays: 7, now: at("2026-11-10 09:30") });
check("trial ends 17 Nov", local(b.trialEnd) === "2026-11-17 09:30");
check("first (prorated) charge at trial end, anchor 1 Dec 12:00 Madrid", local(b.anchor) === "2026-12-01 12:00" && b.prorate);
check("then 1 Jan, 1 Feb… (all on the 1st)", stripeMonthlyRenewals(b.anchor, 3).map(local).join() === "2027-01-01 12:00,2027-02-01 12:00,2027-03-01 12:00");

console.log("\nNo trial");
b = planBilling({ interval: "month", now: at("2026-11-15 18:00") });
check("day 15 → prorated now, full on 1 Dec", !b.trialEnd && local(b.anchor) === "2026-12-01 12:00" && b.prorate);
b = planBilling({ interval: "month", now: at("2026-10-31 23:30") });
check("day 31 late at night → anchor 1 Nov (next day)", local(b.anchor) === "2026-11-01 12:00" && b.prorate);
b = planBilling({ interval: "month", now: at("2026-12-20 10:00") });
check("December → anchor 1 January next year", local(b.anchor) === "2027-01-01 12:00");
b = planBilling({ interval: "month", now: at("2026-11-01 08:00") });
check("on the 1st before noon → anchor at noon, no proration (no tiny invoice)", local(b.anchor) === "2026-11-01 12:00" && !b.prorate);
b = planBilling({ interval: "month", now: at("2026-11-01 16:00") });
check("on the 1st after noon → no anchor needed, full price now", b.anchor === null && !b.prorate);
check("…and Stripe's own anchor (start) keeps renewing on the 1st", stripeMonthlyRenewals(at("2026-11-01 16:00"), 14).every((d) => zoned(d).d === 1));

console.log("\nTrial ending on the 1st");
b = planBilling({ interval: "month", trialDays: 7, now: at("2026-11-24 09:00") });
check("trial ends 1 Dec 09:00 → full charge at 12:00 that day, no proration", local(b.trialEnd) === "2026-12-01 09:00" && local(b.anchor) === "2026-12-01 12:00" && !b.prorate);
b = planBilling({ interval: "month", trialDays: 7, now: at("2026-11-24 15:00") });
check("trial ends 1 Dec 15:00 → no anchor, full charge at trial end", b.anchor === null && !b.prorate);
b = planBilling({ interval: "month", trialDays: 14, now: at("2026-11-30 10:00") });
check("trial crossing the month end → anchor the 1st after the trial", local(b.trialEnd) === "2026-12-14 10:00" && local(b.anchor) === "2027-01-01 12:00");

console.log("\nFebruary, leap years, summer / winter time");
b = planBilling({ interval: "month", now: at("2028-02-29 10:00") });
check("29 Feb (leap year) → 1 Mar", local(b.anchor) === "2028-03-01 12:00");
b = planBilling({ interval: "month", now: at("2027-02-28 22:00") });
check("28 Feb (non-leap) → 1 Mar", local(b.anchor) === "2027-03-01 12:00");
b = planBilling({ interval: "month", trialDays: 3, now: at("2027-03-27 10:00") });
check("trial across the March clock change → still 1 Apr 12:00", local(b.anchor) === "2027-04-01 12:00");
b = planBilling({ interval: "month", now: at("2026-10-25 02:30") });
check("on the October clock-change night → 1 Nov 12:00", local(b.anchor) === "2026-11-01 12:00");
for (const start of ["2026-06-10 10:00", "2026-11-10 10:00", "2027-01-31 23:00", "2027-03-28 01:30", "2028-02-15 12:00"]) {
  const a = planBilling({ interval: "month", now: at(start) }).anchor;
  const ren = stripeMonthlyRenewals(a, 24);
  check(`anchor from ${start}: 24 renewals all on the 1st (Madrid)`, ren.every((d) => zoned(d).d === 1), ren.filter((d) => zoned(d).d !== 1).map(local).join());
}
check("noon anchor is on the 1st in UTC too (why not midnight)", [at("2026-07-01 12:00"), at("2026-12-01 12:00")].every((d) => d.getUTCDate() === 1));
const midnightSummer = at("2026-07-01 00:00");
check("(midnight would be the 30th in UTC → drifts in winter)", midnightSummer.getUTCDate() === 30 && stripeMonthlyRenewals(midnightSummer, 6).some((d) => zoned(d).d !== 1));

console.log("\nYearly");
b = planBilling({ interval: "year", trialDays: 7, now: at("2026-11-10 10:00") });
check("yearly: trial, no day-1 anchor (anniversary)", local(b.trialEnd) === "2026-11-17 10:00" && b.anchor === null);
b = planBilling({ interval: "year", now: at("2026-11-10 10:00") });
check("yearly without trial: starts now, renews on the anniversary", b.anchor === null && b.trialEnd === null);

console.log("\nnextMonthlyAnchor is always strictly in the future");
check("exactly at an anchor → next month", local(nextMonthlyAnchor(at("2026-11-01 12:00"))) === "2026-12-01 12:00");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
