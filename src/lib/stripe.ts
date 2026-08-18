import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-07-29.dahlia",
});

export const PLANS = {
  weekly: {
    id: "weekly",
    name: "Weekly",
    priceId: process.env.STRIPE_PRICE_WEEKLY ?? "",
    amount: 240,
    interval: "week" as const,
  },
  basic_monthly: {
    id: "basic",
    name: "Basic",
    priceId: process.env.STRIPE_PRICE_BASIC_MONTHLY ?? "",
    amount: 999,
    interval: "month" as const,
  },
  basic_annual: {
    id: "basic",
    name: "Basic",
    priceId: process.env.STRIPE_PRICE_BASIC_ANNUAL ?? "",
    amount: 799,
    interval: "year" as const,
  },
  pro_monthly: {
    id: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    amount: 3999,
    interval: "month" as const,
  },
  pro_annual: {
    id: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
    amount: 2999,
    interval: "year" as const,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
