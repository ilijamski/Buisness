import Stripe from "stripe";

/**
 * Stripe-Client für Server Actions und den Webhook.
 * Der Secret Key darf ausschließlich serverseitig verwendet werden.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt.");
  }
  client ??= new Stripe(key);
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_YEARLY,
  );
}

export function priceIdFor(plan: "monthly" | "yearly"): string {
  const id =
    plan === "monthly"
      ? process.env.STRIPE_PRICE_MONTHLY
      : process.env.STRIPE_PRICE_YEARLY;

  if (!id) throw new Error(`Preis-ID für ${plan} fehlt.`);
  return id;
}
