import {
  PAYPAL_BASE_URL,
  PAYPAL_CLIENT_ID,
  PAYPAL_SECRET,
} from "./paypal.config";

// Node 18+ ya tiene fetch global
function btoa(s: string) {
  return Buffer.from(s, "utf8").toString("base64");
}

export async function getAccessToken(): Promise<string> {
  const r = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) {
    throw new Error(`PayPal OAuth failed: ${r.status}`);
  }
  const j = await r.json();
  return j.access_token as string;
}

async function getOrder(paypalId: string, token: string) {
  const r = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r;
}

async function getCapture(paypalId: string, token: string) {
  const r = await fetch(`${PAYPAL_BASE_URL}/v2/payments/captures/${paypalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r;
}

export async function fetchOrderOrCapture(paypalId: string) {
  const token = await getAccessToken();

  let r = await getOrder(paypalId, token);
  if (r.ok) return r.json();

  r = await getCapture(paypalId, token);
  if (r.ok) return r.json();

  // Si no fue ni order ni capture, devolvemos null para que el caller decida.
  return null;
}

export function extractPayInfo(node: any) {
  const capture = node?.purchase_units?.[0]?.payments?.captures?.[0] ?? node;

  const amount = Number(capture?.amount?.value ?? 0);
  const currency = capture?.amount?.currency_code ?? "USD";
  const status = String(capture?.status ?? node?.status ?? "").toUpperCase();
  const id = String(capture?.id ?? node?.id ?? "");

  return { id, amount, currency, status };
}
