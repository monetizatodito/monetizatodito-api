export const PAYPAL_MODE =
  process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";

export const PAYPAL_BASE_URL =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
export const PAYPAL_SECRET = process.env.PAYPAL_SECRET || "";
export const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || "USD";
export const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";
