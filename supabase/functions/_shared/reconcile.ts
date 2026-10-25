// Compare SCP with Stripe and re-apply Stripe's state (stripe-admin "reconcile", billing-cron daily).
import { audit, isoOf, rest, rpc, stripe } from "./stripe.ts";
import { syncSubscription } from "./sync.ts";

// Compare SCP with Stripe and re-apply. Differences are reported (and fixed by re-applying Stripe's state).
export async function reconcile(actor: string | null, onlyUser?: string) {
  const rows = await rest(`subscriptions?select=user_id,plan_key,status,current_period_end,stripe_subscription_id&source=eq.stripe${onlyUser ? `&user_id=eq.${onlyUser}` : ""}`);
  const diffs: unknown[] = [];
  let checked = 0;
  for (const r of rows) {
    if (!r.stripe_subscription_id) continue;
    checked++;
    try {
      const s = await stripe.subscriptions.retrieve(r.stripe_subscription_id);
      // deno-lint-ignore no-explicit-any
      const end = isoOf((s as any).current_period_end ?? (s.items.data[0] as any)?.current_period_end);
      const differs = s.status !== r.status || (end && r.current_period_end && new Date(end).getTime() !== new Date(r.current_period_end).getTime());
      if (differs) diffs.push({ user: r.user_id, subscription: s.id, scp: { status: r.status, period_end: r.current_period_end }, stripe: { status: s.status, period_end: end } });
      await syncSubscription(s);
    } catch (e) {
      diffs.push({ user: r.user_id, subscription: r.stripe_subscription_id, error: String((e as Error).message || e) });
    }
  }
  // failed webhook events → retried by re-reading their objects
  const failed = onlyUser ? [] : await rest(`stripe_events?select=id,type,object_id&status=eq.failed&order=received_at.desc&limit=50`);
  for (const ev of failed) {
    try { const e = await stripe.events.retrieve(ev.id); const o = e.data.object as { id?: string; subscription?: string };
      const subId = e.type.startsWith("customer.subscription") ? o.id : o.subscription;
      if (subId) { await syncSubscription(subId); await rpc("billing_event_end", { p_id: ev.id, p_status: "processed", p_error: "reconciled" }); }
    } catch (_) { /* stays failed */ }
  }
  await audit(actor, "reconcile.run", onlyUser || null, null, { checked, differences: diffs.length, diffs: diffs.slice(0, 50) });
  return { checked, differences: diffs };
}

