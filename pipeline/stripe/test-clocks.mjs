#!/usr/bin/env node
// Validates the day-1 billing rule against Stripe itself, in TEST mode, with Stripe test clocks (simulated time).
// Each scenario creates a test customer on its own clock, a subscription with exactly the parameters stripe-checkout
// sends (from supabase/functions/_shared/billing-dates.js), advances the clock and checks the invoices Stripe produced:
// €0 during the trial, the prorated invoice to the 1st (Stripe's own calculation), then the full price every 1st.
// Also: a card that fails after the trial (→ past_due), a card that needs 3-D Secure (→ action required), yearly.
//   cd pipeline && node stripe/test-clocks.mjs          (needs STRIPE_SECRET_KEY=sk_test_… in pipeline/.env)
//   node stripe/test-clocks.mjs --keep                  (keep the test clocks to inspect them in the Stripe dashboard)
// Only test-mode objects are created (refuses a live key). Test clocks and their customers are deleted at the end.
import Stripe from "stripe";
import { loadEnv } from "../library/env.mjs";
import { planBilling, zoned, unix } from "../../supabase/functions/_shared/billing-dates.js";

loadEnv();
const key = process.env.STRIPE_SECRET_KEY || "";
if (!key.startsWith("sk_test_")) { console.error("Needs a TEST secret key (sk_test_…) in pipeline/.env. This script never runs on live keys."); process.exit(1); }
const stripe = new Stripe(key);
const KEEP = process.argv.includes("--keep");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const local = (t) => { const z = zoned(new Date(t * 1000)); return `${z.y}-${String(z.m).padStart(2, "0")}-${String(z.d).padStart(2, "0")} ${String(z.h).padStart(2, "0")}:${String(z.mi).padStart(2, "0")}`; };
const madrid = (s) => { // "2026-11-10 09:30" Madrid → unix
  const [d, t] = s.split(" "); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number);
  for (let off = -3; off <= 3; off++) { const c = Math.floor(Date.UTC(y, m - 1, dd, h - off, mi) / 1000); if (local(c) === s) return c; } throw new Error(s);
};
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } };

const PRICE_M = 3999, PRICE_Y = 39990;
const product = await stripe.products.create({ name: "SCP test-clock check", metadata: { scp_test: "1" } });
const monthly = await stripe.prices.create({ product: product.id, currency: "eur", unit_amount: PRICE_M, recurring: { interval: "month" }, tax_behavior: "inclusive" });
const yearly = await stripe.prices.create({ product: product.id, currency: "eur", unit_amount: PRICE_Y, recurring: { interval: "year" }, tax_behavior: "inclusive" });
const clocks = [];

async function advance(clock, to) {
  await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: to });
  for (let i = 0; i < 90; i++) { const c = await stripe.testHelpers.testClocks.retrieve(clock.id); if (c.status === "ready") return; await sleep(2000); }
  throw new Error("test clock didn't finish advancing");
}
async function scenario(name, { start, interval = "month", trialDays = 0, card = "pm_card_visa" }) {
  console.log(`\n${name}  (start ${local(start)} Madrid${trialDays ? `, ${trialDays}-day trial` : ""}, ${interval}ly)`);
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: start, name: name.slice(0, 60) });
  clocks.push(clock);
  const customer = await stripe.customers.create({ test_clock: clock.id, email: `clock-${clocks.length}@scp.test`, metadata: { scp_test: "1" } });
  const pm = await stripe.paymentMethods.attach(card, { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
  const b = planBilling({ interval, trialDays, now: new Date(start * 1000) });
  const sub = await stripe.subscriptions.create({
    customer: customer.id, items: [{ price: interval === "year" ? yearly.id : monthly.id }],
    ...(b.trialEnd ? { trial_end: unix(b.trialEnd) } : {}), ...(b.anchor ? { billing_cycle_anchor: unix(b.anchor) } : {}),
    proration_behavior: b.prorate ? "create_prorations" : "none", payment_behavior: "allow_incomplete", off_session: true,
  });
  return { clock, customer, sub, b };
}
const invoices = async (customer) => (await stripe.invoices.list({ customer, limit: 20 })).data.sort((a, z) => a.created - z.created);
const expectedProration = (from, anchor, price) => { // Stripe prorates by time over the period that ends at the anchor
  const a = new Date(anchor * 1000), prev = Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - 1, a.getUTCDate(), a.getUTCHours(), a.getUTCMinutes()) / 1000;
  return Math.round(price * ((anchor - from) / (anchor - prev)));
};

try {
  // 1. The example from the brief: 10 Nov + 7-day trial → prorated 17 Nov → 1 Dec, full on 1 Dec, 1 Jan
  {
    const s = await scenario("1. Subscribe 10 Nov with a 7-day trial", { start: madrid("2026-11-10 09:30"), trialDays: 7 });
    let inv = await invoices(s.customer.id);
    check("today: €0 trial invoice", inv.length >= 1 && inv[0].amount_due === 0, inv.map((i) => i.amount_due).join());
    check("subscription is trialing until 17 Nov", s.sub.status === "trialing" && local(s.sub.trial_end) === "2026-11-17 09:30");
    await advance(s.clock, unix(s.b.trialEnd) + 3600);
    inv = await invoices(s.customer.id);
    const pr = inv[inv.length - 1];
    const exp = expectedProration(unix(s.b.trialEnd), unix(s.b.anchor), PRICE_M);
    check(`trial end: prorated invoice until 1 Dec ≈ €${(exp / 100).toFixed(2)}`, Math.abs(pr.amount_due - exp) <= 2 && pr.status === "paid", `got ${pr.amount_due} (${pr.status})`);
    await advance(s.clock, unix(s.b.anchor) + 3600);
    inv = await invoices(s.customer.id);
    check("1 Dec: full €39.99, paid", inv[inv.length - 1].amount_due === PRICE_M && inv[inv.length - 1].status === "paid", inv.map((i) => i.amount_due).join());
    const sub = await stripe.subscriptions.retrieve(s.sub.id);
    // deno/node: current_period_end lives on the subscription or its item depending on the API version
    const end = sub.current_period_end ?? sub.items.data[0].current_period_end;
    check("next renewal on 1 Jan (Madrid)", local(end).startsWith("2027-01-01"), local(end));
    await advance(s.clock, end + 3600);
    inv = await invoices(s.customer.id);
    check("1 Jan: full €39.99 again", inv[inv.length - 1].amount_due === PRICE_M);
  }
  // 2. No trial, 15th → prorated now, full on the 1st
  {
    const s = await scenario("2. Subscribe on the 15th, no trial", { start: madrid("2026-11-15 18:00") });
    const inv = await invoices(s.customer.id);
    const exp = expectedProration(madrid("2026-11-15 18:00"), unix(s.b.anchor), PRICE_M);
    check(`today: prorated ≈ €${(exp / 100).toFixed(2)} until 1 Dec`, Math.abs(inv[0].amount_due - exp) <= 2, `got ${inv[0].amount_due}`);
    await advance(s.clock, unix(s.b.anchor) + 3600);
    const inv2 = await invoices(s.customer.id);
    check("1 Dec: full price", inv2[inv2.length - 1].amount_due === PRICE_M);
  }
  // 3. 31st late evening
  {
    const s = await scenario("3. Subscribe on 31 Jan 23:00", { start: madrid("2027-01-31 23:00") });
    const inv = await invoices(s.customer.id);
    check("today: a small prorated charge (hours to 1 Feb noon)", inv[0].amount_due > 0 && inv[0].amount_due < 200, `got ${inv[0].amount_due}`);
    await advance(s.clock, unix(s.b.anchor) + 3600);
    await advance(s.clock, madrid("2027-03-01 14:00"));
    const inv2 = await invoices(s.customer.id);
    check("1 Feb and 1 Mar: full price (February handled)", inv2.slice(-2).every((i) => i.amount_due === PRICE_M), inv2.map((i) => `${local(i.created)}:${i.amount_due}`).join(" "));
  }
  // 4. Trial would end on the 1st in the morning → trial runs until noon, full price then, no tiny invoice
  {
    const s = await scenario("4. Trial ending on 1 Dec at 09:00", { start: madrid("2026-11-24 09:00"), trialDays: 7 });
    check("trial extended to 1 Dec 12:00", local(s.sub.trial_end) === "2026-12-01 12:00", local(s.sub.trial_end));
    await advance(s.clock, unix(s.b.trialEnd) + 3600);
    const inv = await invoices(s.customer.id);
    check("no prorated invoice, full €39.99 on 1 Dec", inv.filter((i) => i.amount_due > 0).length === 1 && inv[inv.length - 1].amount_due === PRICE_M, inv.map((i) => i.amount_due).join());
    const sub = await stripe.subscriptions.retrieve(s.sub.id);
    const end = sub.current_period_end ?? sub.items.data[0].current_period_end;
    check("renews on 1 Jan", local(end).startsWith("2027-01-01"), local(end));
  }
  // 4b. No trial, subscribing on the 1st in the morning → a few free hours, full price at noon
  {
    const s = await scenario("4b. Subscribe on 1 Dec at 08:00, no trial", { start: madrid("2026-12-01 08:00") });
    let inv = await invoices(s.customer.id);
    check("nothing charged before noon", inv.every((i) => i.amount_due === 0), inv.map((i) => i.amount_due).join());
    await advance(s.clock, unix(s.b.anchor) + 3600);
    inv = await invoices(s.customer.id);
    check("full €39.99 at noon on the 1st", inv[inv.length - 1].amount_due === PRICE_M, inv.map((i) => i.amount_due).join());
  }
  // 5. Starting on the 1st in the afternoon → full now, renews on the 1st
  {
    const s = await scenario("5. Subscribe on 1 Nov at 16:00", { start: madrid("2026-11-01 16:00") });
    const inv = await invoices(s.customer.id);
    check("full price now", inv[0].amount_due === PRICE_M);
    const end = s.sub.current_period_end ?? s.sub.items.data[0].current_period_end;
    check("renews on 1 Dec", local(end).startsWith("2026-12-01"), local(end));
  }
  // 6. Leap year
  {
    const s = await scenario("6. Subscribe on 29 Feb 2028", { start: madrid("2028-02-29 10:00") });
    check("anchor 1 Mar 2028", local(unix(s.b.anchor)) === "2028-03-01 12:00");
    const inv = await invoices(s.customer.id);
    check("prorated about one day", inv[0].amount_due > 50 && inv[0].amount_due < 300, String(inv[0].amount_due));
  }
  // 7. Yearly with a trial: anniversary, no day-1 anchor
  {
    const s = await scenario("7. Yearly with a 7-day trial", { start: madrid("2026-11-10 10:00"), interval: "year", trialDays: 7 });
    await advance(s.clock, unix(s.b.trialEnd) + 3600);
    const inv = await invoices(s.customer.id);
    check("full yearly price at trial end", inv[inv.length - 1].amount_due === PRICE_Y);
    const sub = await stripe.subscriptions.retrieve(s.sub.id);
    const end = sub.current_period_end ?? sub.items.data[0].current_period_end;
    check("renews on 17 Nov 2027 (anniversary of the trial end)", local(end).startsWith("2027-11-17"), local(end));
  }
  // 8. Card fails when the trial ends → past_due (access kept while Stripe retries, per settings)
  {
    const s = await scenario("8. Card declined after the trial", { start: madrid("2026-11-10 10:00"), trialDays: 7, card: "pm_card_chargeCustomerFail" });
    await advance(s.clock, unix(s.b.trialEnd) + 3600);
    const sub = await stripe.subscriptions.retrieve(s.sub.id);
    check("subscription past_due, invoice open", sub.status === "past_due", sub.status);
  }
  // 9. Card needs 3-D Secure on the first charge → payment requires action (SCA)
  {
    const s = await scenario("9. 3-D Secure card, no trial", { start: madrid("2026-11-15 10:00"), card: "pm_card_authenticationRequired" });
    const sub = await stripe.subscriptions.retrieve(s.sub.id, { expand: ["latest_invoice.payment_intent"] });
    check("first invoice waits for authentication (incomplete)", sub.status === "incomplete", sub.status);
  }
} catch (e) {
  fail++;
  console.error(`\n✗ ${e.message}`);
} finally {
  if (!KEEP) {
    for (const c of clocks) await stripe.testHelpers.testClocks.del(c.id).catch(() => {});
    await stripe.products.update(product.id, { active: false }).catch(() => {});
  } else console.log(`\nKept ${clocks.length} test clocks (Stripe → Billing → Test clocks).`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
